import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { workerScript } from './worker-script';

const API_URL = 'https://api.example';
const WS_URL = 'wss://api.example/sessions/stream?region=eu';
const TOKEN = 'worker-marker-token';
const PROTOCOLS = ['recording.v1', `auth.${TOKEN}`];

interface WorkerMessage {
  type: string;
  msg?: string;
}

interface WebSocketCall {
  url: string;
  protocols: string[];
  socket: ControlledWebSocket;
}

class ControlledWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly url: string;
  readonly protocol: string;
  readyState = ControlledWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; wasClean: boolean }) => void) | null = null;
  sent: string[] = [];

  constructor(calls: WebSocketCall[], url: string | URL, protocols: string | string[] = []) {
    this.url = String(url);
    const offered = typeof protocols === 'string' ? [protocols] : [...protocols];
    this.protocol = offered[0] ?? '';
    calls.push({ url: this.url, protocols: offered, socket: this });
    queueMicrotask(() => {
      this.readyState = ControlledWebSocket.OPEN;
      this.onopen?.();
    });
  }

  send(message: string): void {
    this.sent.push(message);
  }

  close(code = 1000): void {
    this.readyState = ControlledWebSocket.CLOSED;
    this.onclose?.({ code, wasClean: true });
  }

  serverClose(code = 1000, wasClean = true): void {
    this.readyState = ControlledWebSocket.CLOSED;
    this.onclose?.({ code, wasClean });
  }
}

function createHarness(
  mode: 'dedicated' | 'shared',
  initResult: { sessionId: string; sessionToken: string } = {
    sessionId: 'worker-session',
    sessionToken: TOKEN,
  },
) {
  const calls: WebSocketCall[] = [];
  const received: WorkerMessage[] = [];
  const fetchCalls: string[] = [];
  let tabToWorker: ((event: { data: unknown }) => void) | null = null;
  let started = false;

  class TestWebSocket extends ControlledWebSocket {
    static readonly CONNECTING = ControlledWebSocket.CONNECTING;
    static readonly OPEN = ControlledWebSocket.OPEN;
    static readonly CLOSING = ControlledWebSocket.CLOSING;
    static readonly CLOSED = ControlledWebSocket.CLOSED;

    constructor(url: string | URL, protocols?: string | string[]) {
      super(calls, url, protocols);
    }
  }

  class TestSharedWorkerGlobalScope {}

  const port = {
    start: () => {
      started = true;
    },
    postMessage: (message: WorkerMessage) => received.push(message),
    get onmessage() {
      return tabToWorker;
    },
    set onmessage(callback: ((event: { data: unknown }) => void) | null) {
      tabToWorker = callback;
    },
  };

  const dedicatedSelf = {
    postMessage: (message: WorkerMessage) => received.push(message),
    get onmessage() {
      return tabToWorker;
    },
    set onmessage(callback: ((event: { data: unknown }) => void) | null) {
      tabToWorker = callback;
    },
  };
  const self = mode === 'shared' ? new TestSharedWorkerGlobalScope() : dedicatedSelf;

  runInNewContext(workerScript, {
    URL,
    WebSocket: TestWebSocket,
    clearTimeout,
    crypto,
    fetch: async (url: string) => {
      fetchCalls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => initResult,
      };
    },
    queueMicrotask,
    self,
    setTimeout,
    SharedWorkerGlobalScope: mode === 'shared' ? TestSharedWorkerGlobalScope : undefined,
  });

  if (mode === 'shared') {
    const shared = self as TestSharedWorkerGlobalScope & {
      onconnect: (event: { ports: [typeof port] }) => void;
    };
    shared.onconnect({ ports: [port] });
  }

  return {
    calls,
    received,
    fetchCalls,
    send: (data: unknown) => {
      if (!tabToWorker) throw new Error('worker message handler is not installed');
      tabToWorker({ data });
    },
    started: () => started,
  };
}

describe('generated workerScript', () => {
  it.each(['dedicated', 'shared'] as const)(
    'uses header authentication without credential leaks for the %s worker and its reconnect',
    async mode => {
      const harness = createHarness(mode);
      if (mode === 'shared') expect(harness.started()).toBe(true);

      harness.send({
        type: 'hello',
        apiUrl: API_URL,
        websocketUrl: WS_URL,
        clientSecret: 'client-secret',
        tabId: 'tab-1',
        debugLogs: true,
      });
      await vi.waitFor(() => expect(harness.received.some(message => message.type === 'welcome')).toBe(true));

      expect(harness.fetchCalls).toEqual([`${API_URL}/v1/sessions:initSession`]);
      expect(harness.calls[0].url).toBe(WS_URL);
      expect(harness.calls[0].protocols).toEqual(PROTOCOLS);

      harness.calls[0].socket.serverClose();
      await vi.waitFor(() => expect(harness.calls).toHaveLength(2));
      expect(harness.calls[1].url).toBe(WS_URL);
      expect(harness.calls[1].protocols).toEqual(PROTOCOLS);

      const logs = harness.received.filter(message => message.type === 'log').map(message => message.msg ?? '');
      expect(logs.length).toBeGreaterThan(0);
      for (const value of [...harness.calls.map(call => call.url), ...logs]) {
        expect(value).not.toContain(TOKEN);
      }
    },
  );

  it.each(['dedicated', 'shared'] as const)(
    'rejects a legacy credential without logging it in the %s worker',
    async mode => {
      const harness = createHarness(mode, { sessionId: TOKEN, sessionToken: TOKEN });

      harness.send({
        type: 'hello',
        apiUrl: API_URL,
        websocketUrl: `${WS_URL}&session_token=${TOKEN}`,
        clientSecret: 'client-secret',
        tabId: 'tab-1',
        debugLogs: true,
      });
      await vi.waitFor(() => expect(harness.received.some(message => message.type === 'dead')).toBe(true));

      expect(harness.calls).toEqual([]);
      const logs = harness.received.filter(message => message.type === 'log').map(message => message.msg ?? '');
      expect(logs.length).toBeGreaterThan(0);
      for (const log of logs) {
        expect(log).not.toContain(TOKEN);
      }
    },
  );
});
