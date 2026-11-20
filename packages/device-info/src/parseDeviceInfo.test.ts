/**
 * @jest-environment jsdom
 */
import { getDeviceInfo } from './getDeviceInfo';
import { parseDeviceInfo } from './parseDeviceInfo';

const UA = {
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  safari26Iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1',
  chromeIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  safariIpad:
    'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  safari26Ipad:
    'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  operaIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) OPT/4.6.0 Mobile/15E148',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70',
  windowsTabletPc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Tablet PC 2.0; rv:11.0) like Gecko',
  yandexWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 YaBrowser/24.6.0.0 Safari/537.36',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  chromeOs:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  chromeAndroidReduced:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  chromeAndroidTabletReduced:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  samsungAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  firefoxAndroidTablet: 'Mozilla/5.0 (Android 13; Tablet; rv:133.0) Gecko/133.0 Firefox/133.0',
  androidTv:
    'Mozilla/5.0 (Linux; Android 12; BRAVIA 4K UR3 Build/STT1.211025.001.Z4; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Safari/537.36 TV',
  quest:
    'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/34.0.0.0 SamsungBrowser/4.0 Chrome/126.0.0.0 Safari/537.36',
};

const overrides: [object, string, PropertyDescriptor | undefined][] = [];

function override(target: object, key: string, value: unknown) {
  overrides.push([target, key, Object.getOwnPropertyDescriptor(target, key)]);
  Object.defineProperty(target, key, { value, configurable: true });
}

afterEach(() => {
  jest.restoreAllMocks();
  for (const [target, key, descriptor] of overrides.reverse()) {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else delete (target as Record<string, unknown>)[key];
  }
  overrides.length = 0;
});

describe('parseDeviceInfo', () => {
  it.each([
    ['chromeMac', { name: 'macOS' }, { name: 'Chrome', version: '131' }, 'desktop'],
    ['safariMac', { name: 'macOS' }, { name: 'Safari', version: '17' }, 'desktop'],
    ['safariIphone', { name: 'iOS', version: '17.4' }, { name: 'Safari', version: '17' }, 'mobile'],
    ['safari26Iphone', { name: 'iOS', version: '26.1' }, { name: 'Safari', version: '26' }, 'mobile'],
    ['chromeIphone', { name: 'iOS', version: '17.4' }, { name: 'Chrome', version: '131' }, 'mobile'],
    ['safariIpad', { name: 'iPadOS', version: '16.6' }, { name: 'Safari', version: '16' }, 'tablet'],
    ['safari26Ipad', { name: 'iPadOS', version: '26.0' }, { name: 'Safari', version: '26' }, 'tablet'],
    ['operaIphone', { name: 'iOS', version: '17.4' }, { name: 'Opera', version: '4' }, 'mobile'],
    ['edgeWindows', { name: 'Windows' }, { name: 'Edge', version: '131' }, 'desktop'],
    ['windowsTabletPc', { name: 'Windows' }, { name: 'Unknown' }, 'desktop'],
    ['yandexWindows', { name: 'Windows' }, { name: 'Yandex', version: '24' }, 'desktop'],
    ['firefoxLinux', { name: 'Linux' }, { name: 'Firefox', version: '133' }, 'desktop'],
    ['chromeOs', { name: 'ChromeOS' }, { name: 'Chrome', version: '131' }, 'desktop'],
    ['chromeAndroidReduced', { name: 'android' }, { name: 'Chrome', version: '131' }, 'mobile'],
    ['chromeAndroidTabletReduced', { name: 'android' }, { name: 'Chrome', version: '131' }, 'tablet'],
    ['samsungAndroid', { name: 'android', version: '14' }, { name: 'Samsung Internet', version: '25' }, 'mobile'],
    ['firefoxAndroidTablet', { name: 'android', version: '13' }, { name: 'Firefox', version: '133' }, 'tablet'],
    ['androidTv', { name: 'android', version: '12' }, { name: 'Chrome', version: '120' }, 'desktop'],
    ['quest', { name: 'Linux' }, { name: 'Samsung Internet', version: '4' }, 'desktop'],
  ] as const)('parses %s', (key, os, browser, formFactor) => {
    expect(parseDeviceInfo(UA[key])).toEqual({ os, browser, formFactor });
  });

  it('detects iPadOS desktop mode in Safari via touch points and takes the version from Safari', () => {
    expect(parseDeviceInfo(UA.safariMac, undefined, 5)).toEqual({
      os: { name: 'iPadOS', version: '17.4.1' },
      browser: { name: 'Safari', version: '17' },
      formFactor: 'tablet',
    });
  });

  it('detects iPadOS desktop mode in other browsers without a version', () => {
    expect(parseDeviceInfo(UA.chromeMac, undefined, 5)).toEqual({
      os: { name: 'iPadOS' },
      browser: { name: 'Chrome', version: '131' },
      formFactor: 'tablet',
    });
  });

  it('prefers userAgentData brands for the browser', () => {
    const brands = [
      { brand: 'Not_A Brand', version: '8' },
      { brand: 'Chromium', version: '131' },
      { brand: 'Brave', version: '131' },
    ];
    expect(parseDeviceInfo(UA.chromeMac, { mobile: false, brands }, 0).browser).toEqual({
      name: 'Brave',
      version: '131',
    });
  });

  it('falls back to the user agent for brands it does not know', () => {
    const brands = [
      { brand: 'Chromium', version: '121' },
      { brand: 'Samsung Internet', version: '25' },
    ];
    expect(parseDeviceInfo(UA.samsungAndroid, { brands }, 0).browser).toEqual({
      name: 'Samsung Internet',
      version: '25',
    });
  });

  it('leaves out an empty brand version', () => {
    const brands = [{ brand: 'Google Chrome', version: '' }];
    expect(parseDeviceInfo(UA.chromeMac, { brands }, 0).browser).toEqual({ name: 'Chrome' });
  });

  it('prefers userAgentData mobile for the form factor', () => {
    expect(parseDeviceInfo(UA.chromeMac, { mobile: true }, 0).formFactor).toBe('mobile');
    expect(parseDeviceInfo(UA.safariIphone, { mobile: false }, 0).formFactor).toBe('desktop');
  });

  it('uses userAgentData platform when a mobile browser requests the desktop site', () => {
    const desktopModeUa =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    expect(parseDeviceInfo(desktopModeUa, { platform: 'Android', mobile: false }, 5).os).toEqual({ name: 'android' });
  });

  it('returns Unknown for unrecognized user agents', () => {
    expect(parseDeviceInfo('curl/8.0', undefined, 0)).toEqual({
      os: { name: 'Unknown' },
      browser: { name: 'Unknown' },
      formFactor: 'desktop',
    });
  });
});

describe('getDeviceInfo', () => {
  it('reads the current browser', () => {
    jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(UA.safariIphone);
    override(navigator, 'maxTouchPoints', 5);
    expect(getDeviceInfo()).toEqual({
      os: { name: 'iOS', version: '17.4' },
      browser: { name: 'Safari', version: '17' },
      formFactor: 'mobile',
      touch: true,
    });
  });

  it('returns undefined outside the browser', () => {
    override(globalThis, 'navigator', undefined);
    expect(getDeviceInfo()).toBeUndefined();
  });
});
