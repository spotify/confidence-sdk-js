import { getDeviceInfo } from '@spotify-confidence/device-info';
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
  /** OS family — e.g. `windows`, `macos`, `ios`, `ipados`, `android`, `chromeos`, `linux`, or `unknown`. */
  os?: string;
  /** Browser family — e.g. `chrome`, `firefox`, `safari`, `edge`, `samsunginternet`, or `unknown`. */
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

function toFamily(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
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

function collectUri(): string {
  if (window.location.protocol === 'file:') return 'file:///[local]';
  return `${window.location.origin}${window.location.pathname}`;
}

function collectEffectiveConnectionType(): string | undefined {
  return (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
}

export function collectUserAgentContext(): UserAgentContext | undefined {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return undefined;

  const device = getDeviceInfo();

  let timeZone: string | undefined;
  try {
    timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (_e) {
    // Some embedded contexts throw.
  }

  return {
    userAgent: navigator.userAgent,
    os: device && toFamily(device.os.name),
    browser: device && toFamily(device.browser.name),
    browserVersion: device?.browser.version,
    mobile: device && device.formFactor !== 'desktop',
    languageCode: navigator.language,
    timeZone,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
    uri: collectUri(),
    referrer: stripUrlQueryAndHash(document.referrer),
    colorScheme: collectColorScheme(),
    prefersReducedMotion: mediaMatches('(prefers-reduced-motion: reduce)'),
    prefersContrast: collectContrastPreference(),
    forcedColors: mediaMatches('(forced-colors: active)'),
    effectiveConnectionType: collectEffectiveConnectionType(),
  };
}
