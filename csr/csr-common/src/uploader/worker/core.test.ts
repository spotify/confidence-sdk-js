import { describe, expect, it, vi } from 'vitest';
import { createMockPort, installMockFetch, installMockWsServer, jsonResponse } from '../../test-utils';

const API_URL = 'https://api.example';
const WS_URL = 'wss://api.example/sessions/stream?session_token=tok-1';

async function loadCore() {
  vi.resetModules();
  // .js extension is required by Node16 module resolution for dynamic imports
  // (static `import` lines work without it because the package is CJS — see package.json).
  // eslint-disable-next-line es/no-dynamic-import
  return await import('./core.js');
}

function helloMessage(overrides: Record<string, unknown> = {}) {
  return {
    type: 'hello' as const,
    apiUrl: API_URL,
    clientSecret: 'secret',
    tabId: 'tab-A',
    ...overrides,
  };
}

const isType = (type: string) => (m: unknown) => (m as { type: string }).type === type;

interface WelcomeMessage {
  type: 'welcome';
  result: { sessionId: string; sessionToken: string } | { skipRecording: true };
  newTabId?: string;
  resetCounter?: boolean;
  adoptedFromSessionId?: string;
}
interface DeadMessage {
  type: 'dead';
  reason: string;
}

describe('worker/core', () => {
  function setupBackend(initBody: unknown = { sessionId: 'sess-1', sessionToken: 'tok-1' }) {
    const fetchHarness = installMockFetch(() => jsonResponse(initBody));
    const wsHarness = installMockWsServer(WS_URL);
    return { fetchHarness, wsHarness };
  }

  describe('first hello', () => {
    it('runs initSession + openTransport, then sends welcome', async () => {
      const { fetchHarness } = setupBackend();
      const { registerPort } = await loadCore();
      const port = createMockPort();
      registerPort(port.adapter);

      port.tabSends(helloMessage());
      const welcome = await port.next<WelcomeMessage>(isType('welcome'));

      expect(fetchHarness.calls).toHaveLength(1);
      expect(fetchHarness.calls[0].url).toBe(`${API_URL}/v1/sessions:initSession`);
      expect(welcome.result).toEqual({
        sessionId: 'sess-1',
        sessionToken: 'tok-1',
      });
    });

    it('replies with skipRecording when the backend opts out', async () => {
      setupBackend({ skipRecording: true });
      const { registerPort } = await loadCore();
      const port = createMockPort();
      registerPort(port.adapter);

      port.tabSends(helloMessage());
      const welcome = await port.next<WelcomeMessage>(isType('welcome'));

      expect(welcome.result).toEqual({ skipRecording: true });
    });

    it('transitions to dead when initSession throws', async () => {
      installMockFetch(() => new Response(null, { status: 500 }));

      const { registerPort } = await loadCore();
      const port = createMockPort();
      registerPort(port.adapter);

      port.tabSends(helloMessage());
      const dead = await port.next<DeadMessage>(isType('dead'));

      expect(dead.reason).toMatch(/init-session-failed/);
    });
  });

  describe('multiple ports', () => {
    it('queues a second hello during initialization and welcomes it after', async () => {
      setupBackend();
      const { registerPort } = await loadCore();

      const portA = createMockPort();
      const portB = createMockPort();
      registerPort(portA.adapter);
      registerPort(portB.adapter);

      // Both ports race in before the worker has finished init.
      portA.tabSends(helloMessage({ tabId: 'tab-A' }));
      portB.tabSends(helloMessage({ tabId: 'tab-B' }));

      const [aWelcome, bWelcome] = await Promise.all([
        portA.next<WelcomeMessage>(isType('welcome')),
        portB.next<WelcomeMessage>(isType('welcome')),
      ]);
      expect(aWelcome.result).toEqual({
        sessionId: 'sess-1',
        sessionToken: 'tok-1',
      });
      expect(bWelcome.result).toEqual({
        sessionId: 'sess-1',
        sessionToken: 'tok-1',
      });
    });

    it('rejects a second hello with a different clientSecret', async () => {
      setupBackend();
      const { registerPort } = await loadCore();

      const portA = createMockPort();
      const portB = createMockPort();
      registerPort(portA.adapter);
      registerPort(portB.adapter);

      portA.tabSends(helloMessage());
      await portA.next<WelcomeMessage>(isType('welcome'));

      portB.tabSends(helloMessage({ clientSecret: 'different-secret', tabId: 'tab-B' }));
      const dead = await portB.next<DeadMessage>(isType('dead'));

      expect(dead.reason).toMatch(/incompatible-options/);
    });

    it('mints a fresh tabId when a duplicate tab connects', async () => {
      setupBackend();
      const { registerPort } = await loadCore();

      const portA = createMockPort();
      const portB = createMockPort();
      registerPort(portA.adapter);
      registerPort(portB.adapter);

      portA.tabSends(helloMessage({ tabId: 'shared-tab' }));
      await portA.next<WelcomeMessage>(isType('welcome'));
      portB.tabSends(helloMessage({ tabId: 'shared-tab' }));
      const bWelcome = await portB.next<WelcomeMessage>(isType('welcome'));

      expect(bWelcome.newTabId).toBeDefined();
      expect(bWelcome.newTabId).not.toBe('shared-tab');
      expect(bWelcome.resetCounter).toBe(true);
    });
  });

  describe('frame routing', () => {
    it('forwards frames over the open transport once active', async () => {
      const { wsHarness } = setupBackend();
      const { registerPort } = await loadCore();
      const port = createMockPort();
      registerPort(port.adapter);

      port.tabSends(helloMessage());
      await port.next<WelcomeMessage>(isType('welcome'));

      port.tabSends({
        type: 'frame',
        frame: { tabId: 'tab-A', eventCounter: 0, data: { kind: 'click' } },
      });

      expect(JSON.parse(await wsHarness.nextMessage())).toEqual({
        tabId: 'tab-A',
        eventCounter: 0,
        data: { kind: 'click' },
      });
    });

    it('drops frames received before the worker is active', async () => {
      const { wsHarness } = setupBackend();
      const { registerPort } = await loadCore();
      const port = createMockPort();
      registerPort(port.adapter);

      // Send a frame before hello — phase is still 'init'. Should be silently dropped.
      port.tabSends({
        type: 'frame',
        frame: { tabId: 'tab-A', eventCounter: 0, data: 'too-early' },
      });

      // Hello + welcome opens the transport. If the early frame had leaked it'd be
      // buffered in the transport's pending queue and flushed first on open.
      port.tabSends(helloMessage());
      await port.next<WelcomeMessage>(isType('welcome'));

      // Send a real frame and assert it's the *first* message the server sees —
      // the early one would have been ahead of it in the queue had it leaked.
      port.tabSends({
        type: 'frame',
        frame: { tabId: 'tab-A', eventCounter: 0, data: 'real' },
      });
      const message = await wsHarness.nextMessage();
      expect(JSON.parse(message).data).toBe('real');
    });
  });

  describe('debug log forwarding', () => {
    it('only forwards log messages to ports that opted in', async () => {
      setupBackend();
      const { registerPort } = await loadCore();

      const debug = createMockPort();
      const quiet = createMockPort();
      registerPort(debug.adapter);
      registerPort(quiet.adapter);

      debug.tabSends(helloMessage({ debugLogs: true }));
      quiet.tabSends(helloMessage({ tabId: 'tab-B', debugLogs: false }));

      // Both ports get welcome — wait for that as the synchronization point.
      await Promise.all([debug.next<WelcomeMessage>(isType('welcome')), quiet.next<WelcomeMessage>(isType('welcome'))]);

      expect(debug.received.some(isType('log'))).toBe(true);
      expect(quiet.received.some(isType('log'))).toBe(false);
    });
  });

  describe('lifecycle after active', () => {
    it('broadcasts dead to all ports when the transport closes abruptly', async () => {
      const { wsHarness } = setupBackend();
      const { registerPort } = await loadCore();

      const portA = createMockPort();
      const portB = createMockPort();
      registerPort(portA.adapter);
      registerPort(portB.adapter);

      portA.tabSends(helloMessage());
      portB.tabSends(helloMessage({ tabId: 'tab-B' }));
      await Promise.all([portA.next<WelcomeMessage>(isType('welcome')), portB.next<WelcomeMessage>(isType('welcome'))]);

      const ws = await wsHarness.waitForConnection();
      ws.close({ code: 1011, reason: 'server crash', wasClean: false });

      await Promise.all([portA.next<DeadMessage>(isType('dead')), portB.next<DeadMessage>(isType('dead'))]);
    });
  });
});
