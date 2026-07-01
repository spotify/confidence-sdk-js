export interface RecorderOptions {
  /** Engine used to capture DOM events (defaults to rrweb). */
  engine: import('./engine').RecordingEngine;
  /** Called for each recorded event. */
  onEvent: (event: import('@spotify-confidence/csr-common').RecordingEvent) => void;
}

export const DEFAULT_MASK_SELECTORS: string[] = ['[data-csr-mask]'];
export const DEFAULT_BLOCK_SELECTORS: string[] = ['[data-csr-block]'];

export interface RecordingConfig {
  /**
   * CSS selectors for text content that should be masked. Joined with `,` and
   * passed to rrweb as `maskTextSelector`. Text inside matching elements is
   * replaced with `*` of the same length on the wire.
   */
  maskSelectors?: string[];
  /**
   * CSS selectors for elements whose subtree should be blocked entirely.
   * Joined with `,` and passed to rrweb as `blockSelector`. Matching elements
   * are replaced with a same-sized placeholder; their contents are never
   * serialized — stronger than masking, use for media, third-party widgets,
   * or anything that shouldn't leave the page at all.
   */
  blockSelectors?: string[];
  /**
   * Mask the values of every `<input>` / `<textarea>` / `contenteditable`.
   * Defaults to `true` — typed PII (emails, names, search queries) doesn't
   * leave the page. Pass `false` to record raw input values; `<input
   * type="password">` is masked by rrweb regardless.
   */
  maskInputs?: boolean;
  /**
   * Capture browser console output during the recording. Defaults to `false`
   * because console output frequently contains PII, tokens, and other
   * sensitive data that should not be ingested into the recording pipeline
   * without explicit opt-in.
   *
   * - `true` — capture all levels (log, warn, error, debug, info).
   * - `{ levels: [...] }` — capture only the listed levels.
   */
  captureConsoleLogs?: boolean | { levels: import('@spotify-confidence/csr-common').ConsoleLogLevel[] };
  /**
   * Capture network requests (fetch and XMLHttpRequest) during the recording.
   * Defaults to `false` because request URLs and metadata can contain PII,
   * tokens, or other sensitive data.
   *
   * Only metadata is captured (method, URL, status, duration, sizes) — no
   * headers or bodies are recorded.
   */
  captureNetworkRequests?: boolean;
  /**
   * Capture client-side route changes during the recording. Defaults to
   * `true`. Only the pathname is recorded; origin, query strings, and
   * hashes are stripped.
   */
  captureRouteChanges?: boolean;
  /**
   * Transform a raw pathname into a route pattern before it is emitted in
   * route-change and Meta events. For example, `/users/123/profile` becomes
   * `/users/:id/profile`. This ensures per-page metrics are grouped by route
   * rather than by individual page visit.
   *
   * The default implementation replaces common dynamic segments:
   * - UUIDs → `:uuid`
   * - Numeric IDs → `:id`
   * - AIP-122 IDs → `:id`
   * - Long hex strings (20+ chars, e.g. MongoDB ObjectIDs) → `:id`
   *
   * Provide a custom function to handle application-specific patterns.
   * Import `defaultParameterizeRoute` to compose with the built-in rules.
   */
  parameterizeRoute?: (route: string) => string;
  /**
   * Tag each input event with a `userTriggered` flag derived from the
   * browser's `event.isTrusted` property. Defaults to `false`.
   */
  userTriggeredOnInput?: boolean;
}

export enum RecorderState {
  Idle = 'idle',
  Recording = 'recording',
  Stopped = 'stopped',
}
