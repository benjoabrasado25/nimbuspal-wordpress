/**
 * The widget's API client. It has no dependencies because this source also ships
 * inside the WordPress plugin. `apps/api/test/widget-client.test.ts` keeps it in
 * step with the API.
 */
export type ConversationStatus = 'bot' | 'ai' | 'human' | 'closed';
export type MessageSender = 'visitor' | 'bot' | 'ai' | 'agent' | 'system';

export interface WidgetConfig {
  helperName: string;
  greeting: string;
  accentColor: string;
  character?: 'nimbus' | 'mochi' | 'sprig' | 'pip' | 'tully';
  menu: Array<{ id: string; label: string }>;
  showBranding: boolean;
  mode: 'bot' | 'ai';
  teamOnline: boolean;
}

export interface WidgetSession {
  token: string;
  expiresAt: string;
  conversationId: string;
  status: ConversationStatus;
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  content: string;
  createdAt: string;
}

export interface MessageResult {
  message: ChatMessage;
  reply: ChatMessage | null;
  status: ConversationStatus;
}

export interface UpdatesResult {
  messages: ChatMessage[];
  status: ConversationStatus;
  teamOnline: boolean;
  renewed?: { token: string; expiresAt: string };
}

export interface HandoffResult {
  status: ConversationStatus;
  teamOnline: boolean;
  leadCaptured: boolean;
  message: ChatMessage;
}

export class WidgetApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WidgetApiError';
  }
}

export interface WidgetApiOptions {
  apiUrl: string;
  siteKey: string;
  fetch?: typeof fetch;
}

export function createWidgetApi(options: WidgetApiOptions) {
  const base = options.apiUrl.replace(/\/+$/, '');
  const send = options.fetch ?? ((input, init) => fetch(input, init));

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await send(`${base}${path}`, init);
    const body = (await response.json().catch(() => null)) as
      | (T & { error?: { code?: string; message?: string } })
      | null;
    if (!response.ok) {
      throw new WidgetApiError(
        response.status,
        body?.error?.code ?? 'unknown',
        body?.error?.message ?? 'The request failed.',
      );
    }
    return body as T;
  }

  const json = { 'content-type': 'application/json' };
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  return {
    getConfig: () => request<WidgetConfig>(`/widget/config?siteKey=${encodeURIComponent(options.siteKey)}`),
    createSession: () =>
      request<WidgetSession>('/widget/session', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ siteKey: options.siteKey }),
      }),
    sendMessage: (token: string, body: { content: string; menuItemId?: string }) =>
      request<MessageResult>('/widget/message', {
        method: 'POST',
        headers: { ...json, ...bearer(token) },
        body: JSON.stringify(body),
      }),
    getUpdates: (token: string, after: string | null) =>
      request<UpdatesResult>(`/widget/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`, { headers: bearer(token) }),
    requestHandoff: (token: string, body: { name?: string; email?: string; message?: string }) =>
      request<HandoffResult>('/widget/handoff', {
        method: 'POST',
        headers: { ...json, ...bearer(token) },
        body: JSON.stringify(body),
      }),
  };
}

export type WidgetApi = ReturnType<typeof createWidgetApi>;
