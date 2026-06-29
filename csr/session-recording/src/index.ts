import { record } from '@spotify-confidence/csr-recorder';
import type { ConsoleLogLevel } from '@spotify-confidence/csr-common';
import {
  RecordingEventType,
  type TagPluginData,
  type MeasurePluginData,
  type FlagEvaluationPluginData,
  validateKey,
  validateTagValue,
  validateMeasureValue,
} from '@spotify-confidence/csr-common';
import { observeFlags } from './flag-observer';
import { createUploader, type ClientContext } from '@spotify-confidence/csr-common/uploader';
import { SDK_VERSION } from './version';

const DEFAULT_API_URL = 'https://recording.confidence.dev';
const DEFAULT_WEBSOCKET_URL = 'wss://recording-ws.confidence.dev/sessions/stream';
export interface InitSessionRecorderOptions {
  /** Per-tenant secret. */
  clientSecret: string;
  /**
   * End-user identifier (visitor / device id).
   * @deprecated No longer used for session targeting. Will be removed in a future release.
   */
  targetingKey?: string;
  /** CSS selectors whose text content should be masked. */
  maskSelectors?: string[];
  /** CSS selectors whose subtrees should be blocked (replaced with a placeholder, never serialized). */
  blockSelectors?: string[];
  /** Mask values of every `<input>` / `<textarea>` / `contenteditable`. Defaults to `true`. */
  maskInputs?: boolean;
  /** Capture browser console output. Defaults to `false`. Pass `true` for all levels or `{ levels: [...] }` for specific ones. */
  captureConsoleLogs?: boolean | { levels: ConsoleLogLevel[] };
  /** Capture fetch/XHR metadata (method, URL, status, duration). Defaults to `false`. */
  captureNetworkRequests?: boolean;
  /** Capture client-side route changes (pathname only). Defaults to `true`. */
  captureRouteChanges?: boolean;
  /**
   * Transform a raw pathname into a route pattern before it is emitted in
   * route-change and Meta events. For example, `/users/123/profile` becomes
   * `/users/:id/profile`. This ensures per-page metrics are grouped by route
   * rather than by individual page visit.
   *
   * Import `defaultParameterizeRoute` from `@spotify-confidence/csr-recorder`
   * to compose with the built-in rules.
   */
  parameterizeRoute?: (route: string) => string;
  /** Backend base URL. Defaults to the Confidence production endpoint. */
  apiUrl?: string;
  /** WebSocket ingest URL. Defaults to the Confidence production endpoint. */
  websocketUrl?: string;
  /** Application version or commit hash, e.g. "1.2.3" or "abc1234". Stored on the recording for filtering. */
  appVersion?: string;
  /** Custom dimensions merged into the session context alongside auto-collected browser metadata. */
  context?: ClientContext;
  /**
   * `'automatic'` (default) — starts recording as soon as the session is established.
   * `'manual'` — does nothing until `start()` is called, bypassing sampling and targeting rules.
   */
  mode?: 'automatic' | 'manual';
  /** Verbose tracer for debugging — called with one-line lifecycle/transport messages. */
  debugLogger?: (msg: string) => void;
}

export interface SessionRecorder {
  /** Start recording. In `automatic` mode this is a no-op. In `manual` mode it establishes a session and begins recording. */
  start(): void;
  /** Stop recording permanently. Idempotent. */
  stop(): void;
  /** Attach a custom tag to this recording. Tags with the same key accumulate values. Omit value for a valueless marker. */
  tag(key: string, value?: string): void;
  /** Record a numeric measurement. Measurements with the same key are summed. Omit value to count occurrences (each call adds 1). */
  measure(key: string, value?: number): void;
  /** Whether the recorder is actively capturing events. */
  readonly isRecording: boolean;
}

function csrDebugLogger(): ((msg: string) => void) | undefined {
  try {
    if (sessionStorage.getItem('CSR_DEBUG')) {
      // Debug logger intentionally uses console — only active when CSR_DEBUG is set.
      // eslint-disable-next-line no-console
      return (msg: string) => console.log(msg);
    }
  } catch (_e) {
    // sessionStorage may be unavailable (sandboxed iframe, etc.)
  }
  return undefined;
}

/**
 * Create a session recorder. In `automatic` mode (default) recording begins
 * as soon as a session is established. In `manual` mode nothing happens
 * until {@link SessionRecorder.start} is called.
 *
 * Always returns a {@link SessionRecorder} — safe to call, never throws.
 */
export function initSessionRecorder(options: InitSessionRecorderOptions): SessionRecorder {
  const userLogger = options.debugLogger ?? csrDebugLogger();
  const debugLogger = userLogger ? (msg: string) => userLogger(`[CSR] ${msg}`) : undefined;

  let stopRecorder: (() => void) | null = null;
  let closeUploader: (() => void) | null = null;
  let stopObservingFlags: (() => void) | null = null;
  let sendEvent: ((event: unknown) => void) | null = null;
  let started = false;
  let stopped = false;

  const recordingConfig = {
    maskSelectors: options.maskSelectors,
    blockSelectors: options.blockSelectors,
    maskInputs: options.maskInputs,
    captureConsoleLogs: options.captureConsoleLogs,
    captureNetworkRequests: options.captureNetworkRequests,
    captureRouteChanges: options.captureRouteChanges,
    parameterizeRoute: options.parameterizeRoute,
  };

  async function initAndRecord(forceRecord: boolean) {
    try {
      const uploader = await createUploader({
        apiUrl: options.apiUrl ?? DEFAULT_API_URL,
        websocketUrl: options.websocketUrl ?? DEFAULT_WEBSOCKET_URL,
        clientSecret: options.clientSecret,
        targetingKey: options.targetingKey,
        context: {
          ...options.context,
          _csr_sdk_version: SDK_VERSION,
          ...(options.appVersion ? { _app_version: options.appVersion } : {}),
        },
        forceRecord,
        debugLogger,
        onTerminate: ({ reason }) => {
          debugLogger?.(`Recording terminated: ${reason}`);
          stopObservingFlags?.();
          stopObservingFlags = null;
          stopRecorder?.();
          stopRecorder = null;
          stopped = true;
        },
      });

      if (stopped) {
        uploader?.close();
        return;
      }

      if (uploader === null) {
        debugLogger?.('Recording skipped by backend');
        return;
      }

      closeUploader = () => uploader.close();

      sendEvent = event => {
        try {
          uploader(event);
        } catch (err) {
          debugLogger?.(`Event dropped: ${err instanceof Error ? err.message : String(err)}`);
        }
      };

      stopRecorder = record(sendEvent, recordingConfig);

      stopObservingFlags = observeFlags(({ flagKey, variant }) => {
        const data: FlagEvaluationPluginData = {
          plugin: 'csr:flagEvaluation',
          payload: { flagKey, variant },
        };
        sendEvent?.({
          type: RecordingEventType.Plugin,
          timestamp: Date.now(),
          data,
        });
      });
    } catch (err) {
      debugLogger?.(`Recording disabled: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const mode = options.mode ?? 'automatic';

  if (mode === 'automatic') {
    started = true;
    void initAndRecord(false);
  }

  return {
    start() {
      if (started || stopped) return;
      started = true;
      void initAndRecord(true);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      stopObservingFlags?.();
      stopObservingFlags = null;
      stopRecorder?.();
      stopRecorder = null;
      sendEvent = null;
      closeUploader?.();
      closeUploader = null;
    },
    tag(key: string, value?: string) {
      const keyErr = validateKey(key);
      if (keyErr) {
        debugLogger?.(`tag() dropped: ${keyErr}`);
        return;
      }
      const valErr = validateTagValue(value);
      if (valErr) {
        debugLogger?.(`tag() dropped: ${valErr}`);
        return;
      }
      const data: TagPluginData = {
        plugin: 'csr:tag',
        payload: value !== undefined ? { key, value } : { key },
      };
      sendEvent?.({
        type: RecordingEventType.Plugin,
        timestamp: Date.now(),
        data,
      });
    },
    measure(key: string, value?: number) {
      const keyErr = validateKey(key);
      if (keyErr) {
        debugLogger?.(`measure() dropped: ${keyErr}`);
        return;
      }
      const valErr = validateMeasureValue(value);
      if (valErr) {
        debugLogger?.(`measure() dropped: ${valErr}`);
        return;
      }
      const data: MeasurePluginData = {
        plugin: 'csr:measure',
        payload: value !== undefined ? { key, value } : { key },
      };
      sendEvent?.({
        type: RecordingEventType.Plugin,
        timestamp: Date.now(),
        data,
      });
    },
    get isRecording() {
      return stopRecorder !== null;
    },
  };
}
