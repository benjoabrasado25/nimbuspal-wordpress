import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createWidgetApi, WidgetApiError, type ChatMessage, type ConversationStatus, type WidgetConfig, type WidgetSession } from './api';
import { Mascot } from './mascot';
import { createChatStorage } from './storage';

export interface AppProps {
  apiUrl: string;
  siteKey: string;
  position: 'bottom-right' | 'bottom-left';
  inline: boolean;
}

const SEND_ERROR = "Sorry, that didn't send. Please try again.";

export function App({ apiUrl, siteKey, position, inline }: AppProps) {
  const api = useMemo(() => createWidgetApi({ apiUrl, siteKey }), [apiUrl, siteKey]);
  const storage = useMemo(() => createChatStorage(siteKey), [siteKey]);
  const saved = useMemo(() => storage.load(), [storage]);

  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [open, setOpen] = useState(inline);
  const [messages, setMessages] = useState<ChatMessage[]>(saved?.messages ?? []);
  const [status, setStatus] = useState<ConversationStatus | null>(saved?.session.status ?? null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session = useRef<WidgetSession | null>(saved?.session ?? null);
  const log = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getConfig()
      .then((value) => {
        if (!cancelled) setConfig(value);
      })
      .catch((reason: unknown) => {
        // The widget stays hidden: a misconfigured helper should not disturb the site.
        console.warn('[NimbusPal] The helper could not load.', reason instanceof Error ? reason.message : '');
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, sending, open]);

  useEffect(() => {
    if (open && !inline) input.current?.focus();
  }, [open, inline]);

  async function ensureSession(): Promise<WidgetSession> {
    if (session.current) return session.current;
    // Created on the first message, so page views do not create empty conversations.
    session.current = await api.createSession();
    return session.current;
  }

  async function submit(content: string, menuItemId?: string) {
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setDraft('');
    const body = menuItemId ? { content: text, menuItemId } : { content: text };

    try {
      let active = await ensureSession();
      let result;
      try {
        result = await api.sendMessage(active.token, body);
      } catch (reason) {
        if (!(reason instanceof WidgetApiError) || reason.status !== 401) throw reason;
        // The token expired mid-chat: continue in a new session.
        session.current = null;
        active = await ensureSession();
        result = await api.sendMessage(active.token, body);
      }
      const next = [...messages, result.message, ...(result.reply ? [result.reply] : [])];
      setMessages(next);
      setStatus(result.status);
      storage.save({ session: { ...active, status: result.status }, messages: next });
    } catch (reason) {
      if (reason instanceof WidgetApiError && reason.code === 'conversation_closed') {
        session.current = null;
        storage.clear();
        setStatus('closed');
        setError('This chat has ended. Send a new message to start another.');
      } else if (reason instanceof WidgetApiError && reason.code === 'rate_limited') {
        setError(reason.message);
      } else {
        setError(SEND_ERROR);
      }
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  if (!config) return null;

  const isBot = (status ?? config.mode) === 'bot';
  const label = `Chat with ${config.helperName}`;

  const panel = (
    <section
      class={inline ? 'panel panel-inline' : 'panel'}
      role={inline ? 'region' : 'dialog'}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !inline) close();
      }}
    >
      <header class="header">
        <span class="avatar">
          <Mascot />
        </span>
        <div class="title">{config.helperName}</div>
        {!inline && (
          <button type="button" class="close" onClick={close} aria-label="Close chat">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            </svg>
          </button>
        )}
      </header>

      <div class="log" ref={log} role="log" aria-live="polite" tabIndex={0} aria-label="Conversation">
        <div class="bubble bubble-them">{config.greeting}</div>
        {messages.map((message) => (
          <div key={message.id} class={message.sender === 'visitor' ? 'bubble bubble-me' : 'bubble bubble-them'}>
            {message.content}
          </div>
        ))}
        {sending && <div class="typing">{config.helperName} is typing…</div>}
        {isBot && !sending && (
          <div class="menu">
            {config.menu.map((item) => (
              <button type="button" class="chip" key={item.id} onClick={() => void submit(item.label, item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div class="error" role="alert">
          {error}
        </div>
      )}

      <form
        class="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(draft);
        }}
      >
        <label class="visually-hidden" for="nimbuspal-message">
          Your message
        </label>
        <textarea
          id="nimbuspal-message"
          ref={input}
          rows={1}
          maxLength={2000}
          placeholder="Type your message"
          value={draft}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit(draft);
            }
          }}
        />
        <button type="submit" class="send" disabled={sending || !draft.trim()} aria-label="Send message">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M4 12l16-8-6 17-3-7z" fill="currentColor" />
          </svg>
        </button>
      </form>

      {config.showBranding && <div class="branding">Powered by NimbusPal</div>}
    </section>
  );

  return (
    <div class={`root ${inline ? 'root-inline' : `root-${position}`}`} style={{ '--np-accent': config.accentColor }}>
      {open && panel}
      {!inline && (
        <button
          type="button"
          class="launcher"
          ref={launcher}
          aria-label={open ? 'Close chat' : label}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Mascot size={44} />
        </button>
      )}
    </div>
  );
}
