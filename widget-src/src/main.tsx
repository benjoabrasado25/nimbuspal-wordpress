import { render } from 'preact';
import { App, type AppProps } from './app';
import { LEARN_FRAME_NAME, learnWebsite, takeLearnToken } from './learn';
import styles from './styles.css?inline';

interface NimbusPalConfig {
  apiUrl?: string;
  siteKey?: string;
  position?: string;
}

declare global {
  interface Window {
    NimbusPalConfig?: NimbusPalConfig;
    __nimbusPalMounted?: boolean;
  }
}

/** Settings come from the host page, or from data- attributes for the copy-and-paste script. */
function readConfig(script: HTMLOrSVGScriptElement | null): NimbusPalConfig {
  const data = script instanceof HTMLScriptElement ? script.dataset : undefined;
  const fromPage = window.NimbusPalConfig ?? {};
  return {
    apiUrl: fromPage.apiUrl ?? data?.apiUrl,
    siteKey: fromPage.siteKey ?? data?.siteKey,
    position: fromPage.position ?? data?.position,
  };
}

function mount(config: NimbusPalConfig) {
  // A page opened out of sight by "Learn from my website" doesn't need its own chat.
  if (window.__nimbusPalMounted || window.name === LEARN_FRAME_NAME) return;
  if (!config.apiUrl || !config.siteKey) {
    console.warn('[NimbusPal] The helper needs apiUrl and siteKey.');
    return;
  }
  window.__nimbusPalMounted = true;

  // A [nimbuspal] shortcode places the chat in the page. Otherwise it floats in a corner.
  const inlineTarget = document.querySelector<HTMLElement>('[data-nimbuspal-inline]');
  const host = inlineTarget ?? document.createElement('div');
  if (!inlineTarget) {
    host.id = 'nimbuspal-widget';
    document.body.appendChild(host);
  }

  // Shadow DOM keeps the widget's styles and the site's styles from affecting each other.
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);
  const container = document.createElement('div');
  shadow.appendChild(container);

  const position: AppProps['position'] = config.position === 'bottom-left' ? 'bottom-left' : 'bottom-right';
  render(<App apiUrl={config.apiUrl} siteKey={config.siteKey} position={position} inline={Boolean(inlineTarget)} />, container);
}

const config = readConfig(document.currentScript);
const learnToken = window.name === LEARN_FRAME_NAME ? null : takeLearnToken();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mount(config), { once: true });
} else {
  mount(config);
}

let learning = false;
function startLearning(token: string | null) {
  if (!token || !config.apiUrl || learning) return;
  learning = true;
  const start = () => void learnWebsite(config.apiUrl!, token);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
startLearning(learnToken);
// The link can also arrive in a tab that already shows the website, where only the part after the # changes.
if (window.name !== LEARN_FRAME_NAME) window.addEventListener('hashchange', () => startLearning(takeLearnToken()));
