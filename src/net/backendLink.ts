/**
 * Owner: Dev 3. Optional link to the FastAPI backend (leaderboard + live roast).
 * Everything is fire-and-forget: with VITE_BACKEND_URL unset, offline, or the server down,
 * every call quietly does nothing and the game never waits.
 */

export interface Envelope<T = Record<string, unknown>> {
  type: string;
  ts: number;
  payload: T;
}

type Handler = (payload: Record<string, unknown>) => void;

export const HTTP_TIMEOUT_MS = 2500;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 15_000;

export function backendUrl(): string | null {
  const raw = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

export function socketUrl(base: string): string {
  return `${base.replace(/^http/, "ws")}/ws`;
}

export function parseEnvelope(raw: unknown): Envelope | null {
  if (typeof raw !== "string") {
    return null;
  }
  try {
    const message = JSON.parse(raw);
    return typeof message?.type === "string" &&
      typeof message.payload === "object" &&
      message.payload !== null
      ? message
      : null;
  } catch {
    return null;
  }
}

class BackendLink {
  private base: string | null = null;
  private socket: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryMs = RECONNECT_MIN_MS;
  private stopped = true;

  /** Connects once; reconnects with backoff. Returns a teardown function. */
  start(base: string | null = backendUrl(), useSocket = true): () => void {
    this.base = base;
    this.stopped = false;
    if (base && useSocket && typeof WebSocket !== "undefined") {
      this.open();
    }
    return () => this.stop();
  }

  get configured(): boolean {
    return this.base !== null;
  }

  get online(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  on(type: string, handler: Handler): () => void {
    const group = this.handlers.get(type) ?? new Set();
    group.add(handler);
    this.handlers.set(type, group);
    return () => group.delete(handler);
  }

  /** Returns false when the message could not be sent right now. */
  send(type: string, payload: Record<string, unknown>): boolean {
    if (!this.online) {
      return false;
    }
    try {
      this.socket!.send(JSON.stringify({ type, ts: Date.now(), payload }));
      return true;
    } catch {
      return false;
    }
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    if (!this.base) {
      return null;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.base}${path}`, {
        ...init,
        headers: { "content-type": "application/json", ...init.headers },
        signal: abort.signal,
      });
      return response.ok ? ((await response.json()) as T) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private open(): void {
    if (this.stopped || !this.base) {
      return;
    }
    let socket: WebSocket;
    try {
      socket = new WebSocket(socketUrl(this.base));
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.retryMs = RECONNECT_MIN_MS;
    };
    socket.onmessage = (event) => this.dispatch(parseEnvelope(event.data));
    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
        this.scheduleReconnect();
      }
    };
    socket.onerror = () => socket.close();
  }

  private dispatch(message: Envelope | null): void {
    if (!message) {
      return;
    }
    for (const handler of [...(this.handlers.get(message.type) ?? [])]) {
      try {
        handler(message.payload);
      } catch (error) {
        console.warn(`[net] ${message.type} handler failed`, error);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.retryTimer) {
      return;
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, RECONNECT_MAX_MS);
  }

  private stop(): void {
    this.stopped = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }
}

export const backendLink = new BackendLink();
