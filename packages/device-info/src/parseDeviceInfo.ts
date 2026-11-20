import Bowser from 'bowser';

/**
 * A name with an optional version, such as `{ name: 'iOS', version: '17.4' }`.
 * @public
 */
export type NamedVersion = { name: string; version?: string };

/**
 * @public
 */
export type FormFactor = 'mobile' | 'tablet' | 'desktop';

/**
 * The parts of `navigator.userAgentData` used for detection.
 * @public
 */
export type UserAgentData = {
  mobile?: boolean;
  platform?: string;
  brands?: { brand: string; version: string }[];
};

// OS names match the Confidence iOS (`UIDevice.systemName`) and Android SDKs where they overlap.
const OS_NAMES: Record<string, string> = {
  Android: 'android',
  'Chrome OS': 'ChromeOS',
  macOS: 'macOS',
  Windows: 'Windows',
  Linux: 'Linux',
  iOS: 'iOS',
};

// Windows and macOS versions are frozen in user agents (10.0 and 10.15.7), and ChromeOS and Linux
// versions aren't meaningful.
const VERSIONED_OS = ['iOS', 'iPadOS', 'android'];

const BROWSER_NAMES: Record<string, string> = {
  'Microsoft Edge': 'Edge',
  'Opera Touch': 'Opera',
  'Opera Mini': 'Opera Mini',
  Opera: 'Opera',
  'Samsung Internet for Android': 'Samsung Internet',
  'Yandex Browser': 'Yandex',
  Vivaldi: 'Vivaldi',
  Firefox: 'Firefox',
  Chrome: 'Chrome',
  Chromium: 'Chromium',
  Safari: 'Safari',
  Brave: 'Brave',
};

const BRAND_NAMES: Record<string, string> = {
  'Google Chrome': 'Chrome',
  'Microsoft Edge': 'Edge',
  Opera: 'Opera',
  Brave: 'Brave',
};

// Chromium's reduced user agent reports every Android version as "Android 10; K".
const REDUCED_ANDROID = /Android 10; K\)/;
// Safari 26 and later freezes the OS version at 18.6 on iOS and iPadOS, but its own version follows
// the OS version.
const FIRST_FROZEN_SAFARI = 26;
// Android devices that aren't tablets even without "Mobile" in the user agent.
const ANDROID_NON_TABLET = /\bTV\b|SMART-TV|AFT\w+|CrKey|OculusBrowser|Quest|Android Automotive/i;

function withVersion(name: string, version: string | undefined): NamedVersion {
  return version ? { name, version } : { name };
}

function major(version: string | undefined): string | undefined {
  return version?.split('.')[0];
}

function parseFormFactor(userAgent: string, platformType: string | undefined, maxTouchPoints: number): FormFactor {
  if (ANDROID_NON_TABLET.test(userAgent)) return 'desktop';
  // iPadOS 13+ reports itself as macOS by default; real Macs have no touch points.
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'tablet';
  if (platformType === 'tablet' || platformType === 'mobile') return platformType;
  return 'desktop';
}

function parseOs(
  userAgent: string,
  parsed: Bowser.Parser.ParsedResult,
  uaData: UserAgentData | undefined,
  tablet: boolean,
): NamedVersion {
  const name = (parsed.os.name && OS_NAMES[parsed.os.name]) || 'Unknown';
  let os = VERSIONED_OS.includes(name) ? withVersion(name, parsed.os.version) : { name };
  if ((name === 'iOS' || name === 'macOS') && tablet) os = withVersion('iPadOS', os.version);

  if (os.name === 'iOS' || os.name === 'iPadOS') {
    // Safari's version tracks the OS version. Use it when the OS version is missing (iPadOS desktop
    // mode) or frozen (Safari 26+). Other iOS browsers keep the OS version from the UA.
    const safari = parsed.browser.name === 'Safari' ? parsed.browser.version : undefined;
    if (safari && (!os.version || Number(major(safari)) >= FIRST_FROZEN_SAFARI)) {
      os = withVersion(os.name, safari);
    }
  }
  if (os.name === 'android' && REDUCED_ANDROID.test(userAgent)) os = { name: 'android' };

  const platform = uaData?.platform && OS_NAMES[uaData.platform];
  if (platform && platform !== os.name) os = { name: platform };
  return os;
}

/**
 * The detected OS, browser and form factor.
 * @public
 */
export type DeviceInfo = { os: NamedVersion; browser: NamedVersion; formFactor: FormFactor };

/**
 * Detects the OS, browser and form factor from a user agent.
 *
 * @remarks
 * OS names match the Confidence iOS and Android SDKs (`iOS`, `iPadOS`, `android`). Versions that
 * user agents freeze or fake are left out, and `browser.version` is the major version only.
 *
 * @param userAgent - `navigator.userAgent`
 * @param uaData - `navigator.userAgentData`, used over the user agent where available
 * @param maxTouchPoints - `navigator.maxTouchPoints`, used to tell iPads in desktop mode from Macs
 * @public
 */
export function parseDeviceInfo(userAgent: string, uaData?: UserAgentData, maxTouchPoints: number = 0): DeviceInfo {
  const parsed = Bowser.parse(userAgent);
  let formFactor = parseFormFactor(userAgent, parsed.platform.type, maxTouchPoints);
  const os = parseOs(userAgent, parsed, uaData, formFactor === 'tablet');

  const browserName = parsed.browser.name && BROWSER_NAMES[parsed.browser.name];
  let browser = browserName ? withVersion(browserName, major(parsed.browser.version)) : { name: 'Unknown' };
  const brand = uaData?.brands?.find(b => b.brand in BRAND_NAMES);
  if (brand) browser = withVersion(BRAND_NAMES[brand.brand], major(brand.version));

  if (formFactor !== 'tablet' && uaData?.mobile !== undefined) formFactor = uaData.mobile ? 'mobile' : 'desktop';
  return { os, browser, formFactor };
}
