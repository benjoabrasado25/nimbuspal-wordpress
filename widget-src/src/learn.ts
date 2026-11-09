/**
 * "Learn from my website". The owner's dashboard opens their website with a short-lived pass
 * after the #. Here, in the owner's own browser, each page is opened once it has fully drawn,
 * which also works for sites that build their pages in the browser, and its text is sent to
 * NimbusPal as knowledge. Visitors never see this: without a valid pass nothing happens.
 */

export const LEARN_FRAME_NAME = 'nimbuspal-learn';
const HASH_KEY = 'nimbuspal-learn=';
const MAX_PAGES = 30;
const MAX_CHARS = 30_000;
const MIN_CHARS = 80;
const SETTLE_MS = 2500;
/** Pages that are about signing in, paying or private areas teach the helper nothing useful. */
const SKIP = /\/(wp-admin|wp-login|admin|login|log-in|signin|sign-in|signup|sign-up|register|account|my-account|cart|basket|checkout|logout|dashboard|feed)(\/|$)|\.(pdf|jpe?g|png|gif|webp|svg|zip|xml|json|txt|mp4|mp3)$/i;

export function takeLearnToken(): string | null {
  const at = window.location.hash.indexOf(HASH_KEY);
  if (at === -1) return null;
  const token = decodeURIComponent(window.location.hash.slice(at + HASH_KEY.length).split('&')[0] ?? '');
  // Take the pass out of the address bar straight away, so it isn't bookmarked or shared.
  history.replaceState(null, '', window.location.pathname + window.location.search);
  return token.length > 20 ? token : null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function pageKey(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return null;
    url.hash = '';
    url.search = '';
    return SKIP.test(url.pathname) ? null : url.toString();
  } catch {
    return null;
  }
}

function cleanText(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_CHARS);
}

async function findPages(): Promise<string[]> {
  const pages = new Set<string>();
  const add = (href: string) => {
    const key = pageKey(href);
    if (key && pages.size < MAX_PAGES) pages.add(key);
  };
  add(window.location.href);
  try {
    const response = await fetch('/sitemap.xml', { credentials: 'same-origin' });
    if (response.ok) {
      for (const match of (await response.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) add(match[1]!);
    }
  } catch {
    // No sitemap: the links on the page are enough.
  }
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => add(link.href));
  return [...pages];
}

/** Opens a page out of sight, lets it finish drawing, and reads what a visitor would see. */
async function readPage(url: string): Promise<{ title: string; text: string }> {
  const frame = document.createElement('iframe');
  frame.name = LEARN_FRAME_NAME;
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:1200px;height:900px;border:0;visibility:hidden;';
  try {
    const loaded = new Promise<void>((resolve) => {
      frame.addEventListener('load', () => resolve(), { once: true });
      setTimeout(resolve, 15_000);
    });
    frame.src = url;
    document.body.appendChild(frame);
    await loaded;
    await wait(SETTLE_MS);
    const doc = frame.contentDocument;
    if (doc?.body) return { title: doc.title, text: cleanText(doc.body.innerText) };
  } catch {
    // A page that refuses to be framed is read as plain HTML below.
  } finally {
    frame.remove();
  }
  const html = await (await fetch(url, { credentials: 'same-origin' })).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, noscript, template').forEach((node) => node.remove());
  return { title: doc.title, text: cleanText(doc.body?.textContent ?? '') };
}

function showProgress(): (message: string, done?: boolean) => void {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    .box{position:fixed;z-index:2147483647;left:50%;top:24px;transform:translateX(-50%);max-width:min(440px,calc(100vw - 32px));
      padding:16px 20px;border-radius:18px;background:#1b1d4a;color:#fff;font:600 15px/1.45 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25)}
    .small{display:block;margin-top:4px;font-weight:400;font-size:13px;opacity:.8}
    button{margin-top:10px;min-height:36px;padding:0 14px;border:0;border-radius:999px;background:#ff8a65;color:#1b1d4a;font:700 14px system-ui,sans-serif;cursor:pointer}
  </style><div class="box" role="status" aria-live="polite"><span class="text"></span><span class="small"></span></div>`;
  document.body.appendChild(host);
  const text = shadow.querySelector('.text')!;
  const small = shadow.querySelector('.small')!;
  return (message, done = false) => {
    text.textContent = message;
    small.textContent = done ? 'You can close this tab.' : 'Please keep this tab open. It takes about a minute.';
    if (done && !shadow.querySelector('button')) {
      const close = document.createElement('button');
      close.textContent = 'OK';
      close.addEventListener('click', () => host.remove());
      shadow.querySelector('.box')!.appendChild(close);
    }
  };
}

export async function learnWebsite(apiUrl: string, token: string): Promise<void> {
  const show = showProgress();
  show('NimbusPal is reading your website…');
  await wait(SETTLE_MS);
  const pages = await findPages();
  let learned = 0;
  let expired = false;
  for (const [index, url] of pages.entries()) {
    show(`NimbusPal is reading your website… page ${index + 1} of ${pages.length}`);
    try {
      const { title, text } = await readPage(url);
      if (text.length < MIN_CHARS) continue;
      const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/widget/learn`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, url, title: title.slice(0, 200), text }),
      });
      if (response.status === 401) {
        expired = true;
        break;
      }
      if (response.ok) learned += 1;
    } catch {
      // Skip a page that can't be read and carry on with the rest.
    }
  }
  if (expired) show('This link has expired. Please start again from your NimbusPal dashboard.', true);
  else if (learned === 0) show("NimbusPal couldn't find any text to learn on your website. You can add your information in the Knowledge page instead.", true);
  else show(`Done! NimbusPal read ${learned} page${learned === 1 ? '' : 's'}. Your helper will use them within a few minutes.`, true);
}
