import type { ClientContext } from '../client-context';
import type { Client, Frame, Transport } from '../types';
import { CsrClient } from './csr-client';

/** Adapter so this module is unaware of whether it's running in a SharedWorker or a dedicated Worker. */
export interface PortAdapter {
  postMessage(message: unknown): void;
  onmessage(cb: (data: unknown) => void): void;
}

interface HelloMessage {
  type: 'hello';
  apiUrl: string;
  websocketUrl?: string;
  clientSecret: string;
  targetingKey?: string;
  context?: ClientContext;
  forceRecord?: boolean;
  sessionIdHint?: string;
  sessionTokenHint?: string;
  tabId: string;
  debugLogs?: boolean;
}

interface FrameMessage {
  type: 'frame';
  frame: Frame;
}

interface ByeMessage {
  type: 'bye';
  reason: string;
}

type IncomingMessage = HelloMessage | FrameMessage | ByeMessage;

interface PortHandle {
  port: PortAdapter;
  hello: HelloMessage | null;
  /** Whether this port opted into debug log forwarding. Per-port so a quiet tab doesn't pay the message cost when another tab opts in. */
  debugLogs: boolean;
  /** Set when the worker minted a fresh tabId for this port (tab duplication). Sent to the tab in welcome. */
  newTabId?: string;
}

const IDLE_GRACE_MS = 5_000;

type State =
  | { phase: 'init' }
  | { phase: 'initializing' }
  | {
      phase: 'active';
      client: Client;
      transport: Transport;
      sessionId: string;
      sessionToken: string;
    }
  | {
      phase: 'idle';
      client: Client;
      sessionId: string;
      sessionToken: string;
    }
  | { phase: 'skipping' }
  | { phase: 'dead'; reason: string };

let state: State = { phase: 'init' };
const ports: PortHandle[] = [];
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function cancelIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function log(msg: string): void {
  for (const handle of ports) {
    if (handle.debugLogs) handle.port.postMessage({ type: 'log', msg });
  }
}
/**
 * The first hello "locks in" the session's apiUrl/clientSecret. Any later tab arriving
 * with different values is misconfigured — we reject it rather than silently using the
 * locked values. In SharedWorker mode the `name = hash(clientSecret)` scoping already
 * prevents secret-mismatch from sharing a worker, but this defends against the dedicated
 * path and against future bugs.
 */
let lockedConfig: {
  apiUrl: string;
  websocketUrl: string | undefined;
  clientSecret: string;
} | null = null;

export function registerPort(adapter: PortAdapter): void {
  cancelIdleTimer();
  const handle: PortHandle = { port: adapter, hello: null, debugLogs: false };
  ports.push(handle);
  adapter.onmessage((data: unknown) => {
    handleMessage(handle, data as IncomingMessage);
  });
}

function handleMessage(handle: PortHandle, message: IncomingMessage): void {
  switch (message.type) {
    case 'hello':
      handle.hello = message;
      handle.debugLogs = message.debugLogs ?? false;
      if (rejectIfIncompatible(handle)) return;
      // Skip tabId-mint for hellos that won't end up recording anyway.
      if (state.phase !== 'dead' && state.phase !== 'skipping') {
        detectDuplicateTab(handle);
      }
      onHello(handle);
      return;
    case 'frame':
      onFrame(message.frame);
      return;
    case 'bye':
      onBye(handle);
      return;
  }
}

/**
 * Reject hellos whose `apiUrl`/`clientSecret` don't match the values established by the
 * first hello. Returns true if the port was rejected (caller should not continue
 * processing this hello).
 */
function rejectIfIncompatible(handle: PortHandle): boolean {
  if (lockedConfig === null) return false;
  const incoming = handle.hello!;
  if (
    incoming.apiUrl === lockedConfig.apiUrl &&
    incoming.websocketUrl === lockedConfig.websocketUrl &&
    incoming.clientSecret === lockedConfig.clientSecret
  ) {
    return false;
  }
  handle.port.postMessage({
    type: 'dead',
    reason:
      'incompatible-options: apiUrl/websocketUrl/clientSecret differ from the worker session',
  });
  const idx = ports.indexOf(handle);
  if (idx >= 0) ports.splice(idx, 1);
  return true;
}

/**
 * If another already-connected port has the same `tabId`, this hello is from a duplicate
 * tab (browser "Duplicate" command clones sessionStorage). Mint a fresh `tabId` so the two
 * tabs don't collide on the same `(sessionId, tabId)` Recording. The new tabId is returned
 * to the tab in `welcome` so it can update its own state and sessionStorage.
 */
function detectDuplicateTab(handle: PortHandle): void {
  const tabId = handle.hello!.tabId;
  const isDuplicate = ports.some(
    (p) => p !== handle && p.hello?.tabId === tabId,
  );
  if (!isDuplicate) return;
  const fresh = crypto.randomUUID();
  handle.newTabId = fresh;
  handle.hello!.tabId = fresh; // future duplicate checks see this updated id
}

function onHello(handle: PortHandle): void {
  switch (state.phase) {
    case 'init': {
      lockedConfig = {
        apiUrl: handle.hello!.apiUrl,
        websocketUrl: handle.hello!.websocketUrl,
        clientSecret: handle.hello!.clientSecret,
      };
      log(
        `hello received apiUrl=${handle.hello!.apiUrl} websocketUrl=${handle.hello!.websocketUrl ?? '(derive)'} sessionIdHint=${handle.hello!.sessionIdHint ?? '(none)'}`,
      );
      state = { phase: 'initializing' };
      void initializeSession(handle.hello!).then(flushPendingWelcomes);
      return;
    }
    case 'initializing':
      // Welcome will be sent once initialization resolves.
      return;
    case 'active':
      sendActiveWelcome(handle, state.sessionId, state.sessionToken);
      return;
    case 'idle': {
      const { client, sessionId, sessionToken } = state;
      state = { phase: 'initializing' };
      void resumeTransport(client, sessionId, sessionToken).then(
        flushPendingWelcomes,
      );
      return;
    }
    case 'skipping':
      if (handle.hello!.forceRecord) {
        log('forceRecord set; re-initializing from skipping state');
        state = { phase: 'initializing' };
        void initializeSession(handle.hello!).then(flushPendingWelcomes);
        return;
      }
      handle.port.postMessage({
        type: 'welcome',
        result: { skipRecording: true },
      });
      return;
    case 'dead':
      handle.port.postMessage({ type: 'dead', reason: state.reason });
      return;
  }
}

async function initializeSession(firstHello: HelloMessage): Promise<void> {
  const client = new CsrClient(
    firstHello.apiUrl,
    firstHello.clientSecret,
    firstHello.targetingKey,
    firstHello.context,
    firstHello.websocketUrl,
    log,
    firstHello.forceRecord,
  );

  // Try to adopt the hint first. Need both sessionId (for tab-side state) and
  // sessionToken (to authenticate the WS upgrade).
  if (firstHello.sessionIdHint && firstHello.sessionTokenHint) {
    log(`adopting sessionIdHint=${firstHello.sessionIdHint}`);
    try {
      const transport = await client.openTransport(firstHello.sessionTokenHint);
      wireTransport(transport);
      state = {
        phase: 'active',
        client,
        transport,
        sessionId: firstHello.sessionIdHint,
        sessionToken: firstHello.sessionTokenHint,
      };
      log('hint adopted; transport open');
      if (ports.length === 0) {
        idleTimer = setTimeout(enterIdle, IDLE_GRACE_MS);
      }
      return;
    } catch (err) {
      // Stale or rejected — fall through to fresh init.
      log(`hint rejected (${String(err)}); falling back to fresh init`);
    }
  }

  let result:
    | { sessionId: string; sessionToken: string }
    | { skipRecording: true };
  try {
    result = await client.initSession();
  } catch (err) {
    log(`init-session threw: ${String(err)}`);
    transitionToDead(`init-session-failed: ${String(err)}`);
    return;
  }

  if ('skipRecording' in result) {
    log('init-session: skipRecording');
    state = { phase: 'skipping' };
    return;
  }

  log(`init-session ok sessionId=${result.sessionId}`);
  let transport: Transport;
  try {
    transport = await client.openTransport(result.sessionToken);
  } catch (err) {
    log(`openTransport threw: ${String(err)}`);
    transitionToDead(`open-transport-failed: ${String(err)}`);
    return;
  }
  wireTransport(transport);
  log('transport open; session active');
  state = {
    phase: 'active',
    client,
    transport,
    sessionId: result.sessionId,
    sessionToken: result.sessionToken,
  };
  if (ports.length === 0) {
    idleTimer = setTimeout(enterIdle, IDLE_GRACE_MS);
  }
}

async function resumeTransport(
  client: Client,
  sessionId: string,
  sessionToken: string,
): Promise<void> {
  log('resuming transport from idle');
  let transport: Transport;
  try {
    transport = await client.openTransport(sessionToken);
  } catch (err) {
    log(`resume-transport threw: ${String(err)}`);
    transitionToDead(`resume-transport-failed: ${String(err)}`);
    return;
  }
  wireTransport(transport);
  log('transport resumed');
  state = { phase: 'active', client, transport, sessionId, sessionToken };
  if (ports.length === 0) {
    idleTimer = setTimeout(enterIdle, IDLE_GRACE_MS);
  }
}

function wireTransport(transport: Transport): void {
  transport.onClose((info) => {
    if (state.phase !== 'active') return;
    transitionToDead(info.reason);
  });
  transport.onStateChange((info) => {
    if (state.phase !== 'active') return;
    for (const handle of ports) {
      handle.port.postMessage({ type: 'state', connected: info.connected });
    }
  });
}

function transitionToDead(reason: string): void {
  state = { phase: 'dead', reason };
  for (const handle of ports) {
    handle.port.postMessage({ type: 'dead', reason });
  }
}

function flushPendingWelcomes(): void {
  for (const handle of ports) {
    if (handle.hello === null) continue;
    if (state.phase === 'active') {
      sendActiveWelcome(handle, state.sessionId, state.sessionToken);
    } else if (state.phase === 'skipping') {
      handle.port.postMessage({
        type: 'welcome',
        result: { skipRecording: true },
      });
    } else if (state.phase === 'dead') {
      handle.port.postMessage({ type: 'dead', reason: state.reason });
    }
  }
}

function sendActiveWelcome(
  handle: PortHandle,
  currentSessionId: string,
  currentSessionToken: string,
): void {
  const hint = handle.hello?.sessionIdHint;
  const adopted = hint !== undefined && hint !== currentSessionId;
  const newTabId = handle.newTabId;
  handle.port.postMessage({
    type: 'welcome',
    result: { sessionId: currentSessionId, sessionToken: currentSessionToken },
    adoptedFromSessionId: adopted ? hint : undefined,
    newTabId,
    resetCounter: adopted || newTabId !== undefined,
  });
}

function onFrame(frame: Frame): void {
  // In normal flow the tab can't send frames before receiving `welcome` (only sent in
  // 'active') and stops after `dead` (its uploader throws). The race we're guarding is a
  // frame already in flight at the instant we transition out of 'active' — e.g.
  // `transport.onClose` fires while the tab has just posted a frame to the port. Drop it.
  if (state.phase !== 'active') return;
  state.transport.send(frame);
}

function onBye(handle: PortHandle): void {
  const idx = ports.indexOf(handle);
  if (idx >= 0) ports.splice(idx, 1);
  if (ports.length === 0 && state.phase === 'active') {
    log(`last tab disconnected; closing transport in ${IDLE_GRACE_MS}ms`);
    idleTimer = setTimeout(enterIdle, IDLE_GRACE_MS);
  }
}

function enterIdle(): void {
  idleTimer = null;
  if (state.phase !== 'active' || ports.length > 0) return;
  log('idle timeout; closing transport');
  state.transport.close('idle');
  state = {
    phase: 'idle',
    client: state.client,
    sessionId: state.sessionId,
    sessionToken: state.sessionToken,
  };
}
