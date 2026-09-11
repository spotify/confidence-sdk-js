import type { ClientContext } from '../client-context';
import type { Client, Transport } from '../types';
import { WebSocketTransport } from './web-socket-transport';
import { recordingProtocols } from './websocket-auth';

/**
 * Single Client implementation that talks to the recording backend's REST + WS protocol.
 * Both dev-server and prod implement the same protocol, so we don't need polymorphism here yet.
 */
export class CsrClient implements Client {
  constructor(
    private readonly apiUrl: string,
    private readonly clientSecret: string,
    private readonly context: ClientContext | undefined,
    private readonly websocketUrl?: string,
    private readonly log: (msg: string) => void = () => {},
  ) {}

  async initSession(): Promise<{ sessionId: string; sessionToken: string } | { skipRecording: true }> {
    const url = `${this.trimSlash(this.apiUrl)}/v1/sessions:initSession`;
    this.log(`fetch POST ${url}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientSecret: this.clientSecret,
        ...(this.context && Object.keys(this.context).length > 0 ? { context: this.context } : {}),
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
      throw new Error('init-session response missing sessionId or sessionToken');
    }
    return { sessionId: data.sessionId, sessionToken: data.sessionToken };
  }

  async openTransport(sessionToken: string): Promise<Transport> {
    const wsBase = this.websocketUrl ?? `${this.toWsScheme(this.trimSlash(this.apiUrl))}/sessions/stream`;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(wsBase);
    } catch (_error) {
      throw new Error('Invalid WebSocket URL');
    }
    if (parsedUrl.searchParams.has('session_token')) {
      throw new Error('WebSocket URL must not include a session token');
    }
    const protocols = recordingProtocols(sessionToken);
    this.log(`WebSocket connect ${wsBase}`);
    const transport = new WebSocketTransport(wsBase, protocols);
    await transport.ready();
    return transport;
  }

  private trimSlash(s: string): string {
    return s.endsWith('/') ? s.slice(0, -1) : s;
  }

  private toWsScheme(base: string): string {
    if (base.startsWith('https://')) return `wss://${base.slice('https://'.length)}`;
    if (base.startsWith('http://')) return `ws://${base.slice('http://'.length)}`;
    return base;
  }
}
