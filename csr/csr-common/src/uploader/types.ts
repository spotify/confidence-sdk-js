import type { ClientContext } from './client-context';

export interface Uploader {
  (event: unknown): void;
  close(): void;
}

export interface CreateUploaderOptions {
  /** Base URL of the recording backend (serves `/v1/sessions:initSession` and, by default, the WS ingest endpoint). */
  apiUrl: string;
  /**
   * URL of the WebSocket ingest endpoint, including the path (e.g.
   * `wss://recording-ws.confidence.dev/sessions/stream`) but **without** any query —
   * the worker appends `?session_token=…`. Optional: when omitted the worker derives
   * one from `apiUrl` by swapping `http(s)://` → `ws(s)://` and appending
   * `/sessions/stream`. Set this when the init endpoint and the WS ingest live on
   * different hosts (e.g. prod).
   */
  websocketUrl?: string;
  /** Per-tenant secret. Hashed to scope the SharedWorker so different secrets never share a session, and sent in the `initSession` request body. */
  clientSecret: string;
  /** End-user identifier (visitor / device ID). Forwarded in the `initSession` body for sampling and eligibility. */
  targetingKey?: string;
  /**
   * Session context sent in the InitSession request. The SDK auto-populates
   * `userAgent` with browser/OS/screen metadata. Pass any extra keys as
   * custom dimensions.
   */
  context?: ClientContext;
  /** Force a worker mode for testing. Default `"auto"`. */
  workerMode?: 'shared' | 'dedicated' | 'auto';
  /**
   * Optional override for the worker script URL. By default the bundled worker is loaded
   * from a `data:` URL — self-contained, no infrastructure setup, works across tabs
   * (`SharedWorker` is keyed by `(scriptURL, name)` and identical content yields identical
   * data: URLs). Provide this only if your `worker-src` CSP forbids `data:`; you can serve
   * the bundled worker yourself by re-exporting `workerScript` from
   * `csr-common/uploader` and pointing `workerUrl` at the route.
   */
  workerUrl?: string;
  /** Force recording regardless of backend sampling and targeting rules. Included in the `initSession` request body. */
  forceRecord?: boolean;
  /** Tab-side hint expiry; cached `sessionId`s older than this are discarded on init. */
  sessionTtlMs?: number;
  onStateChange?: (state: {
    sessionId: string | null;
    tabId: string | null;
    connected: boolean;
    /**
     * Token issued by `initSession`. Null until the session is established.
     * Most consumers should ignore this; it's exposed for tooling that needs
     * to call session-lifecycle endpoints directly (e.g. `closeSession`).
     */
    sessionToken: string | null;
  }) => void;
  /** Called once when recording is permanently dead. SDK should dismantle the recorder. */
  onTerminate?: (info: { reason: string }) => void;
  /**
   * Optional verbose tracer. Called on key tab- and worker-side events
   * (hello/welcome, init-session URL, ws connect URL, retries, transitions).
   * Worker messages are forwarded over the port and tagged so you can tell them apart.
   */
  debugLogger?: (msg: string) => void;
}

// --- Internal types: used across the worker / tab pieces, not part of the public API. ---

/** Internal: backend-protocol adapter inside the worker bundle. */
export interface Client {
  initSession(): Promise<{ sessionId: string; sessionToken: string } | { skipRecording: true }>;
  /** Opens the data-plane connection. Rejects if `sessionToken` is stale/closed. */
  openTransport(sessionToken: string): Promise<Transport>;
}

/**
 * Internal: one backend-protocol connection. Owns its own retry/reconnect policy.
 * `onClose` fires only when delivery is permanently impossible.
 * `onStateChange` fires when the underlying connection flaps — e.g. a graceful drain
 * triggers reconnect (`connected: false` then `connected: true` once reconnected).
 * Used to surface mid-session state to consumers wiring `onStateChange` for debugging /
 * tests; production consumers typically only care about `onTerminate` (driven by `onClose`).
 */
export interface Transport {
  send(frame: Frame): void;
  close(reason?: string): void;
  onClose(cb: (info: { reason: string }) => void): void;
  onStateChange(cb: (info: { connected: boolean }) => void): void;
}

/** Internal: wire-level frame. Session-id is implicit (Transport is session-bound at open). */
export interface Frame {
  tabId: string;
  /** Monotonic, 0-based per Recording. Resets on adoption. */
  eventCounter: number;
  /** Opaque payload from the recorder. */
  data: unknown;
  /** Set only on the first frame emitted after the tab was adopted into a different session. */
  adoptedFromSessionId?: string;
  /** Epoch millis of the adoption event. */
  adoptedAt?: number;
}
