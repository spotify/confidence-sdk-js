/**
 * A name with an optional version, e.g. an OS or browser.
 * @public
 */
export type NamedVersion = { name: string; version?: string };

/**
 * Form factor of the device.
 * @public
 */
export type FormFactor = 'mobile' | 'tablet' | 'desktop';

export type UserAgentData = {
  mobile?: boolean;
  brands?: { brand: string; version: string }[];
};

type Rule = [name: string, pattern: RegExp];

// OS names match the Confidence iOS (`UIDevice.systemName`) and Android SDKs where they overlap.
// Windows and macOS versions are frozen in user agents (10.0 and 10.15.7), so no version is captured.
const OS_RULES: Rule[] = [
  ['Windows', /Windows NT/],
  ['iPadOS', /iPad.*? OS ([\d_]+)/],
  ['iOS', /(?:iPhone|iPod).*? OS ([\d_]+)/],
  ['android', /Android ([\d.]+)/],
  ['ChromeOS', /CrOS/],
  ['macOS', /Mac OS X/],
  ['Linux', /Linux/],
];

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

function match(rules: Rule[], userAgent: string): NamedVersion {
  for (const [name, pattern] of rules) {
    const result = pattern.exec(userAgent);
    if (result) {
      const version = result[1]?.replace(/_/g, '.');
      return version ? { name, version } : { name };
    }
  }
  return { name: 'Unknown' };
}

function isTablet(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad/.test(userAgent)) return true;
  if (/Android/.test(userAgent) && (/Tablet/.test(userAgent) || !/Mobile/.test(userAgent))) return true;
  // iPadOS 13+ reports itself as macOS by default; real Macs have no touch points.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function parseDeviceInfo(
  userAgent: string,
  uaData: UserAgentData | undefined,
  maxTouchPoints: number,
): { os: NamedVersion; browser: NamedVersion; formFactor: FormFactor } {
  let os = match(OS_RULES, userAgent);
  const tablet = isTablet(userAgent, maxTouchPoints);
  if (os.name === 'macOS' && tablet) {
    // Safari's Version/ token tracks the iPadOS version.
    const version = /Version\/([\d.]+)/.exec(userAgent)?.[1];
    os = version ? { name: 'iPadOS', version } : { name: 'iPadOS' };
  }

  let browser = match(BROWSER_RULES, userAgent);
  const brand = uaData?.brands?.find(b => b.brand in BRAND_NAMES);
  if (brand) {
    browser = { name: BRAND_NAMES[brand.brand], version: brand.version.split('.')[0] };
  }

  let formFactor: FormFactor = 'desktop';
  if (tablet) formFactor = 'tablet';
  else if (uaData?.mobile ?? /Mobi|iPhone|iPod/.test(userAgent)) formFactor = 'mobile';

  return { os, browser, formFactor };
}
