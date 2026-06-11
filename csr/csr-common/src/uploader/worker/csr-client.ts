import type { ClientContext } from '../client-context';
import type { Client, Transport } from '../types';
import { WebSocketTransport } from './web-socket-transport';

/**
 * Single Client implementation that talks to the recording backend's REST + WS protocol.
 * Both dev-server and prod implement the same protocol, so we don't need polymorphism here yet.
 */
export class CsrClient implements Client {
  constructor(
    private readonly apiUrl: string,
    private readonly clientSecret: string,
    private readonly targetingKey: string | undefined,
    private readonly context: ClientContext | undefined,
    private readonly websocketUrl?: string,
    private readonly log: (msg: string) => void = () => {},
    private readonly forceRecord?: boolean,
  ) {}

  async initSession(): Promise<
    { sessionId: string; sessionToken: string } | { skipRecording: true }
  > {
    const url = `${this.trimSlash(this.apiUrl)}/v1/sessions:initSession`;
    this.log(`fetch POST ${url}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientSecret: this.clientSecret,
        ...(this.targetingKey ? { targetingKey: this.targetingKey } : {}),
        ...(this.context && Object.keys(this.context).length > 0
          ? { context: this.context }
          : {}),
        ...(this.forceRecord ? { forceRecord: true } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`init-session failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      sessionId?: string;
      sessionToken?: string;
      skipRecording?: boolean;
    };
    if (data.skipRecording) return { skipRecording: true };
    if (!data.sessionId || !data.sessionToken) {
      throw new Error(
        'init-session response missing sessionId or sessionToken',
      );
    }
    return { sessionId: data.sessionId, sessionToken: data.sessionToken };
  }

  async openTransport(sessionToken: string): Promise<Transport> {
    const wsBase =
      this.websocketUrl ??
      `${this.toWsScheme(this.trimSlash(this.apiUrl))}/sessions/stream`;
    const sep = wsBase.includes('?') ? '&' : '?';
    const url = `${wsBase}${sep}session_token=${encodeURIComponent(sessionToken)}`;
    this.log(`WebSocket connect ${url}`);
    const transport = new WebSocketTransport(url);
    await transport.ready();
    return transport;
  }

  private trimSlash(s: string): string {
    return s.endsWith('/') ? s.slice(0, -1) : s;
  }

  private toWsScheme(base: string): string {
    if (base.startsWith('https://'))
      return `wss://${base.slice('https://'.length)}`;
    if (base.startsWith('http://'))
      return `ws://${base.slice('http://'.length)}`;
    return base;
  }
}
