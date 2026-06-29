import type { CreateUploaderOptions, Frame, Uploader } from './types';
import { ClientContext, collectUserAgentContext } from './client-context';
import { workerScript } from './worker/worker-script';

const STORAGE_TAB_ID = 'csr:tabId';
const STORAGE_SESSION = 'csr:session';
const STORAGE_COUNTER = 'csr:counter';
const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;

interface PortLike {
  postMessage(m: unknown): void;
  setHandler(cb: (data: unknown) => void): void;
}

interface WelcomeMessage {
  type: 'welcome';
  result: { sessionId: string; sessionToken: string } | { skipRecording: true };
  adoptedFromSessionId?: string;
  /** Worker-assigned fresh tabId because this tab is a duplicate of another live one. */
  newTabId?: string;
  resetCounter?: boolean;
}
interface DeadMessage {
  type: 'dead';
  reason: string;
}
interface StateMessage {
  type: 'state';
  connected: boolean;
}
interface LogMessage {
  type: 'log';
  msg: string;
}
type WelcomeOrDead = WelcomeMessage | DeadMessage;
type IncomingMessage = WelcomeMessage | DeadMessage | StateMessage | LogMessage;

export async function createUploader(opts: CreateUploaderOptions): Promise<Uploader | null> {
  const log = opts.debugLogger;
  const sessionTtlMs = opts.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const tabId = readOrMintTabId();
  const sessionHint = readSessionHint(sessionTtlMs);
  const counterHint = readCounter();
  const mode = resolveMode(opts.workerMode ?? 'auto');

  log?.(
    `tab: createUploader mode=${mode} tabId=${tabId} sessionHint=${
      sessionHint?.id ?? '(none)'
    } counterHint=${counterHint}`,
  );

  const port = await openWorkerPort(mode, opts.clientSecret, opts.workerUrl);

  // State accessible to both the message handler (for post-welcome state/dead messages)
  // and the post-welcome setup code below. Mutable so welcome can populate them.
  let phase: 'awaiting-welcome' | 'active' | 'dead' = 'awaiting-welcome';
  let sessionId: string | null = null;
  let sessionToken: string | null = null;
  let effectiveTabId: string = tabId;
  let resolveWelcome!: (msg: WelcomeOrDead) => void;
  const welcomePromise = new Promise<WelcomeOrDead>(res => {
    resolveWelcome = res;
  });

  port.setHandler(data => {
    const msg = data as IncomingMessage;
    if (msg.type === 'log') {
      log?.(`worker: ${msg.msg}`);
      return;
    }
    if (phase === 'awaiting-welcome') {
      if (msg.type === 'welcome' || msg.type === 'dead') {
        phase = msg.type === 'welcome' ? 'active' : 'dead';
        resolveWelcome(msg);
      }
      return;
    }
    if (msg.type === 'state' && sessionId !== null) {
      opts.onStateChange?.({
        sessionId,
        tabId: effectiveTabId,
        connected: msg.connected,
        sessionToken,
      });
      return;
    }
    if (msg.type === 'dead') {
      phase = 'dead';
      if (sessionId !== null) {
        opts.onStateChange?.({
          sessionId,
          tabId: effectiveTabId,
          connected: false,
          sessionToken,
        });
      }
      opts.onTerminate?.({ reason: msg.reason });
    }
  });

  const autoUA = collectUserAgentContext();
  const context: ClientContext = {
    ...(autoUA ? { userAgent: autoUA } : {}),
    ...(opts.context ?? {}),
  };

  port.postMessage({
    type: 'hello',
    apiUrl: opts.apiUrl,
    websocketUrl: opts.websocketUrl,
    clientSecret: opts.clientSecret,
    context,
    forceRecord: opts.forceRecord,
    sessionIdHint: sessionHint?.id,
    sessionTokenHint: sessionHint?.token,
    tabId,
    debugLogs: log !== undefined,
  });
  log?.('tab: hello sent, awaiting welcome');

  const welcome = await welcomePromise;
  log?.(
    welcome.type === 'welcome'
      ? `tab: welcome (${'sessionId' in welcome.result ? `sessionId=${welcome.result.sessionId}` : 'skipRecording'})`
      : `tab: dead reason=${welcome.reason}`,
  );
  if (welcome.type === 'dead') {
    // Worker died before establishing a session — surface the reason instead of swallowing it as `null`.
    throw new Error(`uploader: ${welcome.reason}`);
  }
  if ('skipRecording' in welcome.result) {
    if (opts.forceRecord) {
      log?.('tab: forceRecord was set but backend still skipped — backend may not support forceRecord yet');
    }
    return null;
  }

  sessionId = welcome.result.sessionId;
  sessionToken = welcome.result.sessionToken;
  writeSession(welcome.result.sessionId, welcome.result.sessionToken);

  // If the worker minted a fresh tabId (we're a duplicate of another live tab), adopt it.
  if (welcome.newTabId !== undefined) {
    effectiveTabId = welcome.newTabId;
    sessionStorage.setItem(STORAGE_TAB_ID, effectiveTabId);
  }

  let counter = welcome.resetCounter ? 0 : counterHint;
  let nextAdoptionMeta: Pick<Frame, 'adoptedFromSessionId' | 'adoptedAt'> | undefined =
    welcome.adoptedFromSessionId !== undefined
      ? {
          adoptedFromSessionId: welcome.adoptedFromSessionId,
          adoptedAt: Date.now(),
        }
      : undefined;

  opts.onStateChange?.({
    sessionId,
    tabId: effectiveTabId,
    connected: true,
    sessionToken,
  });

  // Persist counter on pagehide; visibilitychange→hidden as a backup for mobile/BFCache.
  const flush = () => {
    writeCounter(counter);
  };
  window.addEventListener('pagehide', () => {
    flush();
    try {
      port.postMessage({ type: 'bye', reason: 'pagehide' });
    } catch (_e) {
      // ignore
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  const uploader = ((event: unknown) => {
    if (phase === 'dead') {
      throw new Error('uploader: terminated');
    }
    const frame: Frame = {
      tabId: effectiveTabId,
      eventCounter: counter,
      data: event,
      ...(nextAdoptionMeta ?? {}),
    };
    counter += 1;
    nextAdoptionMeta = undefined;
    port.postMessage({ type: 'frame', frame });
  }) as Uploader;

  uploader.close = () => {
    flush();
    try {
      port.postMessage({ type: 'bye', reason: 'stop' });
    } catch (_e) {
      // ignore
    }
  };

  return uploader;
}

function resolveMode(mode: 'shared' | 'dedicated' | 'auto'): 'shared' | 'dedicated' {
  if (mode === 'auto') {
    return typeof SharedWorker !== 'undefined' ? 'shared' : 'dedicated';
  }
  return mode;
}

async function openWorkerPort(
  mode: 'shared' | 'dedicated',
  clientSecret: string,
  workerUrl: string | undefined,
): Promise<PortLike> {
  // Default to a content-derived data URL: identical across tabs (so SharedWorker
  // sharing works) and self-contained (no infrastructure for SDK consumers).
  const url = workerUrl ?? toDataUrl(workerScript);

  if (mode === 'shared') {
    const name = await hashSecret(clientSecret);
    // `extendedLifetime` keeps the SharedWorker alive across top-level navigations on
    // Chrome 139+. No-op everywhere else. Cast required because the option isn't in the
    // standard SharedWorker type yet.
    const options = {
      name,
      type: 'module',
      extendedLifetime: true,
    } as WorkerOptions;
    const worker = new SharedWorker(url, options);
    worker.port.start();
    return {
      postMessage: m => worker.port.postMessage(m),
      setHandler: cb => {
        worker.port.onmessage = (e: MessageEvent) => cb(e.data);
      },
    };
  }

  const worker = new Worker(url, { type: 'module' });
  return {
    postMessage: m => worker.postMessage(m),
    setHandler: cb => {
      worker.onmessage = (e: MessageEvent) => cb(e.data);
    },
  };
}

function toDataUrl(script: string): string {
  // UTF-8-safe base64. The worker bundle is ASCII today but esbuild may emit non-ASCII
  // identifiers if the source ever contains them; this avoids `btoa` choking.
  const bytes = new TextEncoder().encode(script);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:application/javascript;base64,${btoa(binary)}`;
}

async function hashSecret(secret: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function readOrMintTabId(): string {
  let id = sessionStorage.getItem(STORAGE_TAB_ID);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_TAB_ID, id);
  }
  return id;
}

function readSessionHint(ttlMs: number): { id: string; token: string } | null {
  const raw = sessionStorage.getItem(STORAGE_SESSION);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      id: string;
      token?: string;
      ts: number;
    };
    if (Date.now() - parsed.ts > ttlMs) return null;
    if (!parsed.token) return null;
    return { id: parsed.id, token: parsed.token };
  } catch (_e) {
    return null;
  }
}

function writeSession(sessionId: string, sessionToken: string): void {
  sessionStorage.setItem(STORAGE_SESSION, JSON.stringify({ id: sessionId, token: sessionToken, ts: Date.now() }));
}

function readCounter(): number {
  const raw = sessionStorage.getItem(STORAGE_COUNTER);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function writeCounter(counter: number): void {
  sessionStorage.setItem(STORAGE_COUNTER, String(counter));
}
