import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  createWidgetApi,
  WidgetApiError,
  type ChatMessage,
  type ConversationStatus,
  type WidgetConfig,
  type WidgetSession,
} from './api';
import { linkify } from './linkify';
import { Mascot } from './mascot';
import { createChatStorage } from './storage';

export interface AppProps {
  apiUrl: string;
  siteKey: string;
  position: 'bottom-right' | 'bottom-left';
  inline: boolean;
}

const SEND_ERROR = "Sorry, that didn't send. Please try again.";
const POLL_MS = 4000;
const TALK_TO_PERSON_ID = 'talk-to-a-person';

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const known = new Set(current.map((message) => message.id));
  const added = incoming.filter((message) => !known.has(message.id));
  return added.length > 0 ? [...current, ...added] : current;
}

export function App({ apiUrl, siteKey, position, inline }: AppProps) {
  const api = useMemo(() => createWidgetApi({ apiUrl, siteKey }), [apiUrl, siteKey]);
  const storage = useMemo(() => createChatStorage(siteKey), [siteKey]);
  const saved = useMemo(() => storage.load(), [storage]);

  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [open, setOpen] = useState(inline);
  const [messages, setMessages] = useState<ChatMessage[]>(saved?.messages ?? []);
  const [status, setStatus] = useState<ConversationStatus | null>(saved?.session.status ?? null);
  const [teamOnline, setTeamOnline] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');

  const session = useRef<WidgetSession | null>(saved?.session ?? null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const log = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getConfig()
      .then((value) => {
        if (cancelled) return;
        setConfig(value);
        setTeamOnline(value.teamOnline);
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
  }, [messages, sending, open, leadForm]);

  useEffect(() => {
    if (open && !inline) input.current?.focus();
  }, [open, inline]);

  // Any button on the page marked data-nimbuspal-open opens the chat.
  useEffect(() => {
    if (!config || inline) return undefined;
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-nimbuspal-open]')) {
        setOpen(true);
      }
    };
    document.addEventListener('click', onClick);
    // Lets the page show those buttons only once the chat can actually open.
    document.documentElement.setAttribute('data-nimbuspal-ready', '');
    return () => document.removeEventListener('click', onClick);
  }, [config, inline]);

  function persist(active: WidgetSession, nextStatus: ConversationStatus, next: ChatMessage[]) {
    const updated = { ...active, status: nextStatus };
    session.current = updated;
    storage.save({ session: updated, messages: next });
  }

  // While the chat is open, pick up replies from the team and status changes.
  useEffect(() => {
    if (!open || !config) return undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const active = session.current;
      if (active && active.status !== 'closed' && !document.hidden) {
        try {
          const latest = messagesRef.current[messagesRef.current.length - 1]?.createdAt ?? null;
          const updates = await api.getUpdates(active.token, latest);
          if (!stopped) {
            const next = mergeMessages(messagesRef.current, updates.messages);
            setMessages(next);
            setStatus(updates.status);
            setTeamOnline(updates.teamOnline);
            persist(updates.renewed ? { ...active, ...updates.renewed } : active, updates.status, next);
          }
        } catch (reason) {
          if (reason instanceof WidgetApiError && reason.status === 401) {
            session.current = null;
            storage.clear();
          }
        }
      }
      if (!stopped) timer = setTimeout(() => void poll(), POLL_MS);
    };
    timer = setTimeout(() => void poll(), POLL_MS);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [open, config, api]);

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
      const next = mergeMessages(messagesRef.current, [result.message, ...(result.reply ? [result.reply] : [])]);
      setMessages(next);
      setStatus(result.status);
      persist(active, result.status, next);
    } catch (reason) {
      if (reason instanceof WidgetApiError && reason.code === 'conversation_closed') {
        session.current = null;
        storage.clear();
        setStatus(null);
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

  async function askForPerson(details: { name?: string; email?: string } = {}) {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const active = await ensureSession();
      const result = await api.requestHandoff(active.token, details);
      const next = mergeMessages(messagesRef.current, [result.message]);
      setMessages(next);
      setStatus(result.status);
      setTeamOnline(result.teamOnline);
      setLeadForm(false);
      persist(active, result.status, next);
    } catch (reason) {
      if (reason instanceof WidgetApiError && reason.code === 'email_required') {
        setTeamOnline(false);
        setLeadForm(true);
      } else if (reason instanceof WidgetApiError && reason.code === 'invalid_request') {
        setError('Please check your email address.');
      } else {
        setError(SEND_ERROR);
      }
    } finally {
      setSending(false);
    }
  }

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  if (!config) return null;

  const current = status ?? config.mode;
  const withPerson = current === 'human';
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
          <Mascot character={config.character} />
        </span>
        <div class="title">
          <div>{config.helperName}</div>
          <div class={teamOnline ? 'presence presence-on' : 'presence'}>
            <span class="presence-dot" />
            {teamOnline ? 'Team online' : 'Team away'}
          </div>
        </div>
        {!inline && (
          <button type="button" class="close" onClick={close} aria-label="Close chat">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            </svg>
          </button>
        )}
      </header>

      <div class="log" ref={log} role="log" aria-live="polite" tabIndex={0} aria-label="Conversation">
        <div class="bubble bubble-them">{linkify(config.greeting)}</div>
        {messages.map((message) =>
          message.sender === 'system' ? (
            <div key={message.id} class="notice">
              {message.content}
            </div>
          ) : (
            <div key={message.id} class={message.sender === 'visitor' ? 'bubble bubble-me' : 'bubble bubble-them'}>
              {linkify(message.content)}
            </div>
          ),
        )}
        {sending && !leadForm && <div class="typing">{config.helperName} is typing…</div>}

        {!sending && !withPerson && !leadForm && (
          <div class="menu">
            {current === 'bot' &&
              config.menu
                .filter((item) => item.id !== TALK_TO_PERSON_ID)
                .map((item) => (
                  <button type="button" class="chip" key={item.id} onClick={() => void submit(item.label, item.id)}>
                    {item.label}
                  </button>
                ))}
            <button
              type="button"
              class="chip"
              onClick={() => {
                if (teamOnline) void askForPerson();
                else setLeadForm(true);
              }}
            >
              Talk to a person
            </button>
          </div>
        )}

        {leadForm && (
          <form
            class="lead"
            onSubmit={(event) => {
              event.preventDefault();
              void askForPerson({ email: leadEmail.trim(), ...(leadName.trim() ? { name: leadName.trim() } : {}) });
            }}
          >
            <p>The team is away right now. Leave your email and they'll reply as soon as they can.</p>
            <label for="nimbuspal-lead-name">Your name (optional)</label>
            <input id="nimbuspal-lead-name" type="text" maxLength={120} autoComplete="name" value={leadName} onInput={(event) => setLeadName(event.currentTarget.value)} />
            <label for="nimbuspal-lead-email">Your email</label>
            <input id="nimbuspal-lead-email" type="email" required maxLength={254} autoComplete="email" value={leadEmail} onInput={(event) => setLeadEmail(event.currentTarget.value)} />
            <div class="lead-actions">
              <button type="submit" class="lead-send" disabled={sending}>
                Send
              </button>
              <button type="button" class="lead-cancel" onClick={() => setLeadForm(false)}>
                Not now
              </button>
            </div>
          </form>
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
          class={open ? 'launcher launcher-open' : 'launcher'}
          ref={launcher}
          aria-label={open ? 'Close chat' : label}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span class="launcher-face">
            <Mascot size={38} character={config.character} />
          </span>
          {!open && <span class="launcher-label">{label}</span>}
        </button>
      )}
    </div>
  );
}
