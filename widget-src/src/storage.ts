import type { ChatMessage, WidgetSession } from './api';

export interface SavedChat {
  session: WidgetSession;
  messages: ChatMessage[];
}

/**
 * Keeps the chat across page views in one tab. Browser storage can be blocked or
 * throw, so every failure simply means the chat starts fresh on the next page.
 */
export function createChatStorage(siteKey: string) {
  const key = `nimbuspal:${siteKey}`;
  return {
    load(): SavedChat | null {
      try {
        const raw = window.sessionStorage.getItem(key);
        if (!raw) return null;
        const saved = JSON.parse(raw) as SavedChat;
        if (new Date(saved.session.expiresAt).getTime() <= Date.now()) {
          window.sessionStorage.removeItem(key);
          return null;
        }
        return saved;
      } catch {
        return null;
      }
    },
    save(chat: SavedChat): void {
      try {
        window.sessionStorage.setItem(key, JSON.stringify(chat));
      } catch {
        // Nothing to do: the chat still works for this page.
      }
    },
    clear(): void {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // Nothing to do.
      }
    },
  };
}
