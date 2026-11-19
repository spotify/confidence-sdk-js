import Bowser from 'bowser';
import { stripUrlQueryAndHash } from '../url';

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
  /** Document referrer — without query/hash to avoid leaking PII. */
  referrer?: string;
  /** Active color scheme at session init — `dark` or `light`. */
  colorScheme?: 'dark' | 'light';
  /** Whether the user prefers reduced motion. */
  prefersReducedMotion?: boolean;
  /** User contrast preference — `more`, `less`, or `no-preference`. */
  prefersContrast?: 'more' | 'less' | 'no-preference';
  /** Whether Windows High Contrast / forced-colors mode is active. */
  forcedColors?: boolean;
  /** Network effective type at session init (e.g. `4g`, `3g`). */
  effectiveConnectionType?: string;
};

export interface ClientContext {
  userAgent?: UserAgentContext;
  [key: string]: ContextValue | undefined;
}

function mediaMatches(query: string): boolean | undefined {
  return window.matchMedia?.(query).matches;
}

function collectColorScheme(): UserAgentContext['colorScheme'] {
  if (!window.matchMedia) return undefined;
  return mediaMatches('(prefers-color-scheme: dark)') ? 'dark' : 'light';
}

function collectContrastPreference(): UserAgentContext['prefersContrast'] {
  if (!window.matchMedia) return undefined;
  if (mediaMatches('(prefers-contrast: more)')) return 'more';
  if (mediaMatches('(prefers-contrast: less)')) return 'less';
  return 'no-preference';
}

function collectEffectiveConnectionType(): string | undefined {
  return (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
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
    referrer: stripUrlQueryAndHash(document.referrer),
    colorScheme: collectColorScheme(),
    prefersReducedMotion: mediaMatches('(prefers-reduced-motion: reduce)'),
    prefersContrast: collectContrastPreference(),
    forcedColors: mediaMatches('(forced-colors: active)'),
    effectiveConnectionType: collectEffectiveConnectionType(),
  };
}
