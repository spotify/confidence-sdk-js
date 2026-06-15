import Bowser from 'bowser';

/**
 * JSON-shaped values accepted in a Context — matches `google.protobuf.Struct`.
 */
export type ContextValue = string | number | boolean | null | ContextValue[] | { [key: string]: ContextValue };

/**
 * Browser-environment metadata captured at session init. Sent verbatim in the
 * `context` field of the InitSession request.
 */
export type UserAgentContext = {
  userAgent?: string;
  /** Coarse OS family — `windows`, `macos`, `ios`, `android`, `linux`, or `unknown`. */
  os?: string;
  /** Coarse browser family — `chrome`, `firefox`, `safari`, `edge`, or `unknown`. */
  browser?: string;
  /** Browser major version. */
  browserVersion?: string;
  mobile?: boolean;
  /** BCP-47 language tag (e.g. `en-US`). */
  languageCode?: string;
  /** IANA time zone (e.g. `Europe/Stockholm`). */
  timeZone?: string;
  /** Viewport in CSS pixels. */
  viewportWidth?: number;
  viewportHeight?: number;
  /** Physical screen in CSS pixels. */
  screenWidth?: number;
  screenHeight?: number;
  devicePixelRatio?: number;
  /** Initial document URI — without query/hash to avoid leaking PII. */
  uri?: string;
  referrer?: string;
};

export interface ClientContext {
  userAgent?: UserAgentContext;
  [key: string]: ContextValue | undefined;
}

export function collectUserAgentContext(): UserAgentContext | undefined {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return undefined;

  const parsed = Bowser.parse(navigator.userAgent);

  let timeZone: string | undefined;
  try {
    timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (_e) {
    // Some embedded contexts throw.
  }

  return {
    userAgent: navigator.userAgent,
    os: parsed.os.name?.toLowerCase().replace(/\s+/g, ''),
    browser: parsed.browser.name?.toLowerCase().replace(/\s+/g, ''),
    browserVersion: parsed.browser.version?.split('.')[0],
    mobile: parsed.platform.type ? parsed.platform.type === 'mobile' || parsed.platform.type === 'tablet' : undefined,
    languageCode: navigator.language,
    timeZone,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
    uri: `${window.location.origin}${window.location.pathname}`,
    referrer: document.referrer,
  };
}
