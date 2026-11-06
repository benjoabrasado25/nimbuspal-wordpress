import type { ComponentChildren } from 'preact';

// Emails and web addresses only. Anything else, such as javascript: links, stays plain text.
const LINK = /([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})|(https?:\/\/[^\s<>"']+)/g;
const TRAILING = /[.,!?;:)\]]+$/;

/** Turns addresses in a message into links. Built as elements, so a message can never inject HTML. */
export function linkify(text: string): ComponentChildren {
  const parts: ComponentChildren[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const found = match[0];
    const clean = found.replace(TRAILING, '');
    const start = match.index ?? 0;
    parts.push(text.slice(last, start));
    parts.push(
      match[1] ? (
        <a href={`mailto:${clean}`}>{clean}</a>
      ) : (
        <a href={clean} target="_blank" rel="noopener noreferrer">
          {clean}
        </a>
      ),
    );
    last = start + clean.length;
  }
  parts.push(text.slice(last));
  return parts;
}
