export type NamedVersion = { name: string; version?: string };

export type FormFactor = 'mobile' | 'tablet' | 'desktop';

export type UserAgentData = {
  mobile?: boolean;
  platform?: string;
  brands?: { brand: string; version: string }[];
};

type Rule = [name: string, pattern: RegExp];

// OS names match the Confidence iOS (`UIDevice.systemName`) and Android SDKs where they overlap.
// Windows and macOS versions are frozen in user agents (10.0 and 10.15.7), and ChromeOS and Linux
// versions aren't meaningful, so no version is captured for them.
const OS_RULES: Rule[] = [
  ['Windows', /Windows NT/],
  ['iPadOS', /iPad.*? OS ([\d_]+)/],
  ['iOS', /(?:iPhone|iPod).*? OS ([\d_]+)/],
  ['android', /Android ([\d.]+)/],
  ['ChromeOS', /CrOS/],
  ['macOS', /Mac OS X/],
  ['Linux', /Linux/],
];

// `navigator.userAgentData.platform` values, which stay correct when a browser requests the
// desktop version of a site.
const PLATFORM_NAMES: Record<string, string> = {
  Android: 'android',
  'Chrome OS': 'ChromeOS',
  Linux: 'Linux',
  macOS: 'macOS',
  Windows: 'Windows',
};

// Order matters: most browsers include "Chrome" and "Safari" in their user agent.
const BROWSER_RULES: Rule[] = [
  ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
  ['Opera Mini', /Opera Mini\/(\d+)/],
  ['Opera', /(?:OPR|OPT|Opera)\/(\d+)/],
  ['Samsung Internet', /SamsungBrowser\/(\d+)/],
  ['Yandex', /YaBrowser\/(\d+)/],
  ['Vivaldi', /Vivaldi\/(\d+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /Version\/(\d+).*Safari/],
];

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

function match(rules: Rule[], userAgent: string): NamedVersion {
  for (const [name, pattern] of rules) {
    const result = pattern.exec(userAgent);
    if (result) return withVersion(name, result[1]?.replace(/_/g, '.'));
  }
  return { name: 'Unknown' };
}

function isTablet(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad/.test(userAgent)) return true;
  if (/Android/.test(userAgent) && !ANDROID_NON_TABLET.test(userAgent)) {
    return /Tablet/.test(userAgent) || !/Mobile/.test(userAgent);
  }
  // iPadOS 13+ reports itself as macOS by default; real Macs have no touch points.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

function parseOs(userAgent: string, uaData: UserAgentData | undefined, tablet: boolean): NamedVersion {
  let os = match(OS_RULES, userAgent);
  if (os.name === 'macOS' && tablet) os = { name: 'iPadOS' };

  if (os.name === 'iOS' || os.name === 'iPadOS') {
    // Safari's Version/ token tracks the OS version. Use it when the OS version is missing (iPadOS
    // desktop mode) or frozen (Safari 26+). Other iOS browsers keep the OS version from the UA.
    const safari = /Version\/([\d.]+).*Safari/.exec(userAgent)?.[1];
    if (safari && (!os.version || Number(safari.split('.')[0]) >= FIRST_FROZEN_SAFARI)) {
      os = withVersion(os.name, safari);
    }
  }
  if (os.name === 'android' && REDUCED_ANDROID.test(userAgent)) os = { name: 'android' };

  const platform = uaData?.platform && PLATFORM_NAMES[uaData.platform];
  if (platform && platform !== os.name) os = { name: platform };
  return os;
}

export function parseDeviceInfo(
  userAgent: string,
  uaData: UserAgentData | undefined,
  maxTouchPoints: number,
): { os: NamedVersion; browser: NamedVersion; formFactor: FormFactor } {
  const tablet = isTablet(userAgent, maxTouchPoints);
  const os = parseOs(userAgent, uaData, tablet);

  let browser = match(BROWSER_RULES, userAgent);
  const brand = uaData?.brands?.find(b => b.brand in BRAND_NAMES);
  if (brand) {
    browser = withVersion(BRAND_NAMES[brand.brand], brand.version.split('.')[0]);
  }

  let formFactor: FormFactor = 'desktop';
  if (tablet) formFactor = 'tablet';
  else if (uaData?.mobile ?? /Mobi|iPhone|iPod/.test(userAgent)) formFactor = 'mobile';

  return { os, browser, formFactor };
}
