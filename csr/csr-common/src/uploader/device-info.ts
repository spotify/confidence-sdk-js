import Bowser from 'bowser';

/**
 * A name with an optional version, such as `{ name: 'iOS', version: '17.4' }`.
 */
export type NamedVersion = { name: string; version?: string };

/**
 */
export type FormFactor = 'mobile' | 'tablet' | 'desktop';

/**
 * The parts of `navigator.userAgentData` used for detection.
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

// Checked in order: Messenger and Instagram user agents also contain Facebook tokens.
const IN_APP_BROWSERS: [name: InAppBrowser, pattern: RegExp][] = [
  ['messenger', /FBAN\/Messenger|FB_IAB\/MESSENGER|\bOrca-Android\b/i],
  ['instagram', /\bInstagram\b/],
  ['facebook', /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFB4A\b|\bFBIOS\b/],
  ['tiktok', /musical_ly|\bBytedanceWebview\b|\bTikTok\b/],
  ['snapchat', /\bSnapchat\b/],
  ['linkedin', /\bLinkedInApp\b/],
  ['pinterest', /\bPinterest\b/],
  ['x', /\bTwitter for\b|\bTwitterAndroid\b/],
  ['wechat', /\bMicroMessenger\b/],
  ['line', /\bLine\/\d/i],
  ['google', /\bGSA\//],
];
// Android web views add "wv". iOS web views lack the "Safari/" token that iOS browsers keep.
const ANDROID_WEBVIEW = /; wv\)/;
const IOS_WEBVIEW = /(?:iPhone|iPod|iPad).*AppleWebKit(?!.*Safari\/)/;
// iPads in desktop mode report a Mac user agent.
const IPAD_DESKTOP_WEBVIEW = /Macintosh.*AppleWebKit(?!.*Safari\/)/;
const IOS_BROWSERS_WITHOUT_SAFARI_TOKEN = /\bOPT\/|\bEdgiOS\/|\bFxiOS\//;
const BOT =
  /bot\b|crawl|spider|slurp|HeadlessChrome|Lighthouse|PhantomJS|facebookexternalhit|Bytespider|Google-InspectionTool|PTST\/|^curl\/|^Wget\/|python-requests|axios\/|node-fetch|Go-http-client|okhttp/i;
// "Cubot" is a phone brand, not a bot.
const NOT_BOT = /\bCubot\b/i;

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
 * Apps whose built-in browser can be detected.
 */
export type InAppBrowser =
  | 'messenger'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'snapchat'
  | 'linkedin'
  | 'pinterest'
  | 'x'
  | 'wechat'
  | 'line'
  | 'google';

/**
 * The detected OS, browser and form factor.
 */
export type DeviceInfo = {
  os: NamedVersion;
  browser: NamedVersion;
  formFactor: FormFactor;
  /** The app whose built-in browser opened the page, such as `instagram` or `tiktok`. */
  inAppBrowser?: InAppBrowser;
  /** Whether the page runs in an app's web view rather than a standalone browser. */
  webview: boolean;
  /** Whether the user agent belongs to a crawler, monitoring tool or HTTP library. */
  bot: boolean;
};

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

  const inAppBrowser = IN_APP_BROWSERS.find(([, pattern]) => pattern.test(userAgent))?.[0];
  const webview =
    !!inAppBrowser ||
    ANDROID_WEBVIEW.test(userAgent) ||
    ((IOS_WEBVIEW.test(userAgent) || (maxTouchPoints > 1 && IPAD_DESKTOP_WEBVIEW.test(userAgent))) &&
      !IOS_BROWSERS_WITHOUT_SAFARI_TOKEN.test(userAgent));
  const bot = BOT.test(userAgent) && !NOT_BOT.test(userAgent);
  const info: DeviceInfo = { os, browser, formFactor, webview, bot };
  if (inAppBrowser) info.inAppBrowser = inAppBrowser;
  return info;
}

/**
 * Detects the OS, browser and form factor of the current browser, and whether it has a touch screen.
 * `bot` is also true when the browser is controlled by automation (`navigator.webdriver`).
 *
 * @returns `undefined` outside the browser
 */
export function getDeviceInfo(): (DeviceInfo & { touch: boolean }) | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const uaData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const info = parseDeviceInfo(navigator.userAgent ?? '', uaData, maxTouchPoints);
  return { ...info, bot: info.bot || navigator.webdriver === true, touch: maxTouchPoints > 0 };
}
