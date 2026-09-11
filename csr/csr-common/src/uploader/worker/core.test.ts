import { describe, expect, it, vi } from 'vitest';
import { createMockPort, installMockFetch, installMockWsServer, jsonResponse } from '../../test-utils';

const API_URL = 'https://api.example';
const WS_URL = 'wss://api.example/sessions/stream';

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
  workerHash?: string;
  newTabId?: string;
  resetCounter?: boolean;
  adoptedFromSessionId?: string;
}
interface DeadMessage {
  type: 'dead';
  reason: string;
}
interface SessionRestartedMessage {
  type: 'session-restarted';
  result: { sessionId: string; sessionToken: string };
  adoptedFromSessionId: string;
}
interface LogMessage {
  type: 'log';
  msg: string;
}

const asLog = (m: unknown) => m as LogMessage;

describe('worker/core', () => {
  function setupBackend(
    initBody: unknown = { sessionId: 'sess-1', sessionToken: 'tok-1' },
    selectProtocol?: (protocols: string[], connectionIndex: number) => string,
  ) {
    const fetchHarness = installMockFetch(() => jsonResponse(initBody));
    const wsHarness = installMockWsServer(WS_URL, { selectProtocol });
    return { fetchHarness, wsHarness };
  }

  describe('first hello', () => {
    it('runs initSession + openTransport, then sends welcome', async () => {
      const { fetchHarness, wsHarness } = setupBackend();
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
      expect(wsHarness.connections[0].url).toBe(WS_URL);
      expect(wsHarness.protocolOffers).toEqual([['recording.v1', 'auth.tok-1']]);
    });

    it('includes workerHash in welcome when set on globalThis', async () => {
      (globalThis as Record<string, unknown>).__WORKER_HASH__ = 'abc123';
      setupBackend();
      const { registerPort } = await loadCore();
      const port = createMockPort();
      registerPort(port.adapter);

      port.tabSends(helloMessage());
      const welcome = await port.next<WelcomeMessage>(isType('welcome'));

      expect(welcome.workerHash).toBe('abc123');
      delete (globalThis as Record<string, unknown>).__WORKER_HASH__;
    });

    it('workerHash is undefined when not set on globalThis', async () => {
      setupBackend();
      const { registerPort } = await loadCore();
      const port = createMockPort();
      registerPort(port.adapter);

      port.tabSends(helloMessage());
      const welcome = await port.next<WelcomeMessage>(isType('welcome'));

      expect(welcome.workerHash).toBeUndefined();
    });

    it('replies with skipRecording when the backend opts out', async () => {
      const { fetchHarness } = setupBackend({ skipRecording: true });
      const { registerPort } = await loadCore();
      const firstPort = createMockPort();
      const secondPort = createMockPort();
      registerPort(firstPort.adapter);
      registerPort(secondPort.adapter);

      firstPort.tabSends(helloMessage());
      const firstWelcome = await firstPort.next<WelcomeMessage>(isType('welcome'));

      // A stale caller may still send the retired property at runtime. It must not
      // turn an ordinary backend skip into a fresh InitSession attempt.
      secondPort.tabSends(helloMessage({ tabId: 'tab-B', forceRecord: true }));
      const secondWelcome = await secondPort.next<WelcomeMessage>(isType('welcome'));

      expect(firstWelcome.result).toEqual({ skipRecording: true });
      expect(secondWelcome.result).toEqual({ skipRecording: true });
      expect(fetchHarness.calls).toHaveLength(1);
    });

    it.each([429, 500, 503])('does not retry InitSession after HTTP %i', async status => {
      const fetchHarness = installMockFetch(() => new Response(null, { status }));

      const { registerPort } = await loadCore();
      const firstPort = createMockPort();
      const secondPort = createMockPort();
      registerPort(firstPort.adapter);
      registerPort(secondPort.adapter);

      firstPort.tabSends(helloMessage());
      const firstDead = await firstPort.next<DeadMessage>(isType('dead'));

      secondPort.tabSends(helloMessage({ tabId: 'tab-B' }));
      const secondDead = await secondPort.next<DeadMessage>(isType('dead'));

      expect(firstDead.reason).toMatch(new RegExp(`init-session-failed:.*HTTP ${status}`));
      expect(secondDead.reason).toBe(firstDead.reason);
      expect(fetchHarness.calls).toHaveLength(1);
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

    it('does not expose a session token through configured URLs', async () => {
      const token = 'leaky-sensitive';
      setupBackend({ sessionId: 'session-1', sessionToken: token });
      const { registerPort } = await loadCore();
      const port = createMockPort();
      registerPort(port.adapter);

      port.tabSends(
        helloMessage({
          websocketUrl: `${WS_URL}?session_token=${token}`,
          sessionIdHint: 'session-1',
          sessionTokenHint: token,
          debugLogs: true,
        }),
      );
      await port.next<DeadMessage>(isType('dead'));

      const logs = port.received.filter(isType('log')).map(message => (message as { msg: string }).msg);
      expect(logs.length).toBeGreaterThan(0);
      for (const log of logs) {
        expect(log).not.toContain(token);
      }
    });
  });

  describe('lifecycle after active', () => {
    it('starts a fresh session on user activity after the previous session ends', async () => {
      let initCount = 0;
      const fetchHarness = installMockFetch(() => {
        initCount += 1;
        return jsonResponse({
          sessionId: `sess-${initCount}`,
          sessionToken: `tok-${initCount}`,
        });
      });
      const wsHarness = installMockWsServer(WS_URL);
      const { registerPort } = await loadCore();

      const port = createMockPort();
      registerPort(port.adapter);

      port.tabSends(helloMessage());
      await port.next<WelcomeMessage>(isType('welcome'));

      const ws = await wsHarness.waitForConnection();
      ws.close({ code: 1011, reason: 'storage failure', wasClean: false });
      await port.next(isType('state'));

      port.tabSends({
        type: 'frame',
        frame: { tabId: 'tab-A', eventCounter: 1, data: 'mutation', userActivity: false },
      });
      expect(fetchHarness.calls).toHaveLength(1);

      port.tabSends({
        type: 'frame',
        frame: { tabId: 'tab-A', eventCounter: 2, data: 'click', userActivity: true },
      });

      const restarted = await port.next<SessionRestartedMessage>(isType('session-restarted'));
      expect(restarted).toEqual({
        type: 'session-restarted',
        result: { sessionId: 'sess-2', sessionToken: 'tok-2' },
        adoptedFromSessionId: 'sess-1',
      });
      expect(fetchHarness.calls).toHaveLength(2);
      await wsHarness.waitForConnection();

      port.tabSends({
        type: 'frame',
        frame: { tabId: 'tab-A', eventCounter: 0, data: 'full-snapshot', userActivity: false },
      });
      expect(JSON.parse(await wsHarness.nextMessage())).toEqual({
        tabId: 'tab-A',
        eventCounter: 0,
        data: 'full-snapshot',
        userActivity: false,
      });
      expect(port.received.some(isType('dead'))).toBe(false);
    });

    it('uses a fresh header credential when a session hint fails protocol negotiation', async () => {
      const { fetchHarness, wsHarness } = setupBackend(
        { sessionId: 'fresh-session', sessionToken: 'fresh-sensitive' },
        (protocols, connectionIndex) => (connectionIndex === 0 ? '' : protocols[0]),
      );
      const { registerPort } = await loadCore();
      const port = createMockPort();
      registerPort(port.adapter);

      port.tabSends(
        helloMessage({
          sessionIdHint: 'stale-session',
          sessionTokenHint: 'stale-sensitive',
          debugLogs: true,
        }),
      );
      const welcome = await port.next<WelcomeMessage>(isType('welcome'));

      expect(welcome.result).toEqual({
        sessionId: 'fresh-session',
        sessionToken: 'fresh-sensitive',
      });
      expect(fetchHarness.calls).toHaveLength(1);
      expect(wsHarness.protocolOffers).toEqual([
        ['recording.v1', 'auth.stale-sensitive'],
        ['recording.v1', 'auth.fresh-sensitive'],
      ]);
      expect(wsHarness.connections.every(connection => connection.url === WS_URL)).toBe(true);
      const logs = port.received.filter(isType('log')).map(message => (message as { msg: string }).msg);
      expect(logs.some(log => log.includes('sessionIdHint=stale-session'))).toBe(true);
      expect(logs).toContain('adopting sessionIdHint=stale-session');
      expect(logs).toContain('init-session ok sessionId=fresh-session');
      for (const log of logs) {
        expect(log).not.toContain('stale-sensitive');
        expect(log).not.toContain('c3RhbGUtc2Vuc2l0aXZl');
        expect(log).not.toContain('fresh-sensitive');
        expect(log).not.toContain('ZnJlc2gtc2Vuc2l0aXZl');
      }
    });

    // Adapted from main: those assertions predate recovery, when a closed transport was
    // terminal. The auth-path coverage is preserved; the expected outcome is now `interrupted`.
    it('treats a 4401 after the upgrade as recoverable rather than terminal', async () => {
      const { fetchHarness, wsHarness } = setupBackend();
      // The API checks session state after the upgrade. A valid token for a missing or
      // closed session therefore opens successfully before the server rejects it.
      wsHarness.server.on('connection', () => {
        setTimeout(() => wsHarness.server.close({ code: 4401, reason: 'Unauthorized', wasClean: true }), 0);
      });
      const { registerPort } = await loadCore();
      const port = createMockPort();
      registerPort(port.adapter);

      port.tabSends(helloMessage({ sessionIdHint: 'stale-session', sessionTokenHint: 'stale-sensitive' }));
      const welcome = await port.next<WelcomeMessage>(isType('welcome'));
      await port.next(isType('state'));

      expect(welcome.result).toEqual({ sessionId: 'stale-session', sessionToken: 'stale-sensitive' });
      // Recovery waits for user activity, so nothing is re-initialised yet and no tab is told
      // to dismantle its recorder.
      expect(fetchHarness.calls).toHaveLength(0);
      expect(port.received.some(isType('dead'))).toBe(false);
      expect(wsHarness.protocolOffers).toEqual([['recording.v1', 'auth.stale-sensitive']]);
      expect(wsHarness.connections).toHaveLength(1);
      expect(wsHarness.connections[0].url).toBe(WS_URL);
    });

    it('recovers after one failed header-authenticated reconnect', async () => {
      const { fetchHarness, wsHarness } = setupBackend(undefined, (protocols, connectionIndex) =>
        connectionIndex === 0 ? protocols[0] : '',
      );
      const { registerPort } = await loadCore();
      const port = createMockPort();
      registerPort(port.adapter);

      port.tabSends(helloMessage({ debugLogs: true }));
      await port.next<WelcomeMessage>(isType('welcome'));
      const first = await wsHarness.waitForConnection();
      first.close({ code: 1000, reason: 'drain', wasClean: true });

      // A second offer proves the drain was treated as recoverable and a reconnect attempted.
      await vi.waitFor(() => expect(wsHarness.protocolOffers).toHaveLength(2));
      expect(wsHarness.protocolOffers).toEqual([
        ['recording.v1', 'auth.tok-1'],
        ['recording.v1', 'auth.tok-1'],
      ]);
      expect(port.received.some(isType('dead'))).toBe(false);
      expect(fetchHarness.calls).toHaveLength(1);
      expect(wsHarness.connections.every(connection => connection.url === WS_URL)).toBe(true);
    });

    it('broadcasts the restarted session to every attached port', async () => {
      let initCount = 0;
      installMockFetch(() => {
        initCount += 1;
        return jsonResponse({ sessionId: `sess-${initCount}`, sessionToken: `tok-${initCount}` });
      });
      const wsHarness = installMockWsServer(WS_URL);
      const { registerPort } = await loadCore();

      const portA = createMockPort();
      const portB = createMockPort();
      registerPort(portA.adapter);
      registerPort(portB.adapter);

      portA.tabSends(helloMessage());
      portB.tabSends(helloMessage({ tabId: 'tab-B' }));
      await Promise.all([portA.next<WelcomeMessage>(isType('welcome')), portB.next<WelcomeMessage>(isType('welcome'))]);

      const ws = await wsHarness.waitForConnection();
      ws.close({ code: 1011, reason: 'storage failure', wasClean: false });
      await Promise.all([portA.next(isType('state')), portB.next(isType('state'))]);

      portA.tabSends({
        type: 'frame',
        frame: { tabId: 'tab-A', eventCounter: 1, data: 'click', userActivity: true },
      });

      const [restartedA, restartedB] = await Promise.all([
        portA.next<SessionRestartedMessage>(isType('session-restarted')),
        portB.next<SessionRestartedMessage>(isType('session-restarted')),
      ]);
      expect(restartedA).toEqual({
        type: 'session-restarted',
        result: { sessionId: 'sess-2', sessionToken: 'tok-2' },
        adoptedFromSessionId: 'sess-1',
      });
      expect(restartedB).toEqual(restartedA);
    });

    it('drops pre-restart frames until the tab emits its fresh snapshot', async () => {
      let initCount = 0;
      installMockFetch(() => {
        initCount += 1;
        return jsonResponse({ sessionId: `sess-${initCount}`, sessionToken: `tok-${initCount}` });
      });
      const wsHarness = installMockWsServer(WS_URL);
      const { registerPort } = await loadCore();

      const port = createMockPort();
      registerPort(port.adapter);
      port.tabSends(helloMessage());
      await port.next<WelcomeMessage>(isType('welcome'));

      const ws = await wsHarness.waitForConnection();
      ws.close({ code: 1011, reason: 'storage failure', wasClean: false });
      await port.next(isType('state'));

      port.tabSends({
        type: 'frame',
        frame: { tabId: 'tab-A', eventCounter: 108, data: 'click', userActivity: true },
      });
      await port.next<SessionRestartedMessage>(isType('session-restarted'));
      await wsHarness.waitForConnection();

      // Posted by the tab before it processed `session-restarted`: previous recording's
      // counter, and a mutation referencing a snapshot the new recording never received.
      port.tabSends({
        type: 'frame',
        frame: { tabId: 'tab-A', eventCounter: 109, data: 'stale-mutation', userActivity: false },
      });
      // The tab has now reset and restarted capture, so its snapshot arrives at counter 0.
      port.tabSends({
        type: 'frame',
        frame: { tabId: 'tab-A', eventCounter: 0, data: 'full-snapshot', userActivity: false },
      });

      expect(JSON.parse(await wsHarness.nextMessage())).toMatchObject({
        eventCounter: 0,
        data: 'full-snapshot',
      });
    });

    it('does not strand a tab that was still awaiting welcome when the session restarted', async () => {
      let initCount = 0;
      installMockFetch(() => {
        initCount += 1;
        return jsonResponse({ sessionId: `sess-${initCount}`, sessionToken: `tok-${initCount}` });
      });
      const wsHarness = installMockWsServer(WS_URL);
      const { registerPort } = await loadCore();

      const portA = createMockPort();
      registerPort(portA.adapter);
      portA.tabSends(helloMessage());
      await portA.next<WelcomeMessage>(isType('welcome'));

      const ws = await wsHarness.waitForConnection();
      ws.close({ code: 1011, reason: 'storage failure', wasClean: false });
      await portA.next(isType('state'));

      // A tab arriving now drives the restart, but it is still awaiting its welcome when
      // `session-restarted` goes out — and a tab in that phase ignores everything except
      // welcome/dead, so it never sees the reset.
      const portB = createMockPort();
      registerPort(portB.adapter);
      portB.tabSends(helloMessage({ tabId: 'tab-B' }));

      const welcomeB = await portB.next<WelcomeMessage>(isType('welcome'));
      await wsHarness.waitForConnection();

      // Its `csr:session` hint may have expired while `csr:counter` survived (the counter has
      // no TTL), so the welcome has to reset the counter or the tab keeps a non-zero one.
      expect(welcomeB.resetCounter).toBe(true);

      portB.tabSends({
        type: 'frame',
        frame: { tabId: 'tab-B', eventCounter: 108, data: 'post-welcome', userActivity: true },
      });

      expect(JSON.parse(await wsHarness.nextMessage())).toMatchObject({
        tabId: 'tab-B',
        data: 'post-welcome',
      });
    });

    it('answers a hello that arrives while recovery is failing', async () => {
      let initCount = 0;
      installMockFetch(() => {
        initCount += 1;
        return initCount === 1
          ? jsonResponse({ sessionId: 'sess-1', sessionToken: 'tok-1' })
          : jsonResponse({ error: 'unavailable' }, 503);
      });
      const wsHarness = installMockWsServer(WS_URL);
      const { registerPort } = await loadCore();

      const portA = createMockPort();
      registerPort(portA.adapter);
      portA.tabSends(helloMessage());
      await portA.next<WelcomeMessage>(isType('welcome'));

      const ws = await wsHarness.waitForConnection();
      ws.close({ code: 1011, reason: 'storage failure', wasClean: false });
      await portA.next(isType('state'));

      // A tab arriving now has no uploader, so it cannot emit the activity frame that
      // would drive recovery. Left unanswered it would hang until its welcome timeout.
      const portB = createMockPort();
      registerPort(portB.adapter);
      portB.tabSends(helloMessage({ tabId: 'tab-B' }));

      const dead = await portB.next<DeadMessage>(isType('dead'));
      expect(dead.reason).toBe('session-restart-failed');
      // The established tab keeps its recorder — a late dead would dismantle it.
      expect(portA.received.some(isType('dead'))).toBe(false);
    });

    it('backs off after a failed restart instead of retrying on every active frame', async () => {
      let initCount = 0;
      const fetchHarness = installMockFetch(() => {
        initCount += 1;
        return initCount === 1
          ? jsonResponse({ sessionId: 'sess-1', sessionToken: 'tok-1' })
          : jsonResponse({ error: 'unavailable' }, 503);
      });
      const wsHarness = installMockWsServer(WS_URL);
      const { registerPort } = await loadCore();

      const port = createMockPort();
      registerPort(port.adapter);
      port.tabSends(helloMessage({ debugLogs: true }));
      await port.next<WelcomeMessage>(isType('welcome'));

      const ws = await wsHarness.waitForConnection();
      ws.close({ code: 1011, reason: 'storage failure', wasClean: false });
      await port.next(isType('state'));

      const activeFrame = {
        type: 'frame',
        frame: { tabId: 'tab-A', eventCounter: 1, data: 'click', userActivity: true },
      };
      port.tabSends(activeFrame);
      // Wait for the failed restart to settle back into `interrupted`, otherwise the
      // follow-up frames land during `restarting` and are dropped for the wrong reason.
      await port.next<LogMessage>(m => isType('log')(m) && /waiting for user activity to retry/.test(asLog(m).msg));
      expect(fetchHarness.calls).toHaveLength(2);

      // Still inside the backoff window, so these must not spend another initSession.
      port.tabSends(activeFrame);
      port.tabSends(activeFrame);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(fetchHarness.calls).toHaveLength(2);
      expect(port.received.some(isType('dead'))).toBe(false);
    });
  });
});
