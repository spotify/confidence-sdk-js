import type { DeviceInfo } from './deviceInfo';

export type UserAgentData = {
  platform?: string;
  mobile?: boolean;
  brands?: { brand: string; version: string }[];
};

type Rule = [name: string, pattern: RegExp];

const OS_RULES: Rule[] = [
  ['Windows', /Windows NT ([\d.]+)/],
  ['iOS', /(?:iPhone|iPad|iPod).*? OS ([\d_]+)/],
  ['Android', /Android ([\d.]+)/],
  ['ChromeOS', /CrOS [\w]+ ([\d.]+)/],
  ['macOS', /Mac OS X ([\d_.]+)/],
  ['Linux', /Linux()/],
];

// Order matters: most browsers include "Chrome" and "Safari" in their user agent.
const BROWSER_RULES: Rule[] = [
  ['Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
  ['Opera', /(?:OPR|Opera)\/([\d.]+)/],
  ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
  ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
  ['Safari', /Version\/([\d.]+).*Safari/],
];

const BRAND_NAMES: Record<string, string> = {
  'Google Chrome': 'Chrome',
  'Microsoft Edge': 'Edge',
  Opera: 'Opera',
  Chromium: 'Chromium',
};

function match(rules: Rule[], userAgent: string): { name: string; version?: string } {
  for (const [name, pattern] of rules) {
    const result = pattern.exec(userAgent);
    if (result) {
      const version = result[1]?.replace(/_/g, '.');
      return version ? { name, version } : { name };
    }
  }
  return { name: 'Unknown' };
}

function deviceType(userAgent: string, uaData: UserAgentData | undefined): DeviceInfo['type'] {
  // iPadOS 13+ reports itself as macOS, so detect it via touch support.
  if (/iPad|Tablet/.test(userAgent) || (/Android/.test(userAgent) && !/Mobile/.test(userAgent))) return 'tablet';
  if (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1) return 'tablet';
  if (uaData?.mobile ?? /Mobi|iPhone|iPod/.test(userAgent)) return 'mobile';
  return 'desktop';
}

export function parseDeviceInfo(
  userAgent: string,
  uaData?: UserAgentData,
): Pick<DeviceInfo, 'os' | 'browser' | 'type'> {
  const os = match(OS_RULES, userAgent);
  const type = deviceType(userAgent, uaData);
  if (os.name === 'macOS' && type === 'tablet') {
    os.name = 'iOS';
    delete os.version;
  }
  let browser = match(BROWSER_RULES, userAgent);
  const brand = uaData?.brands?.find(({ brand }) => brand in BRAND_NAMES && brand !== 'Chromium');
  if (brand) {
    browser = { name: BRAND_NAMES[brand.brand], version: brand.version };
  }
  return { os, browser, type };
}
