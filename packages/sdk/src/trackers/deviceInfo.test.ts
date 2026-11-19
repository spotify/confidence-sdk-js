/**
 * @jest-environment jsdom
 */
import { Trackable } from '../Trackable';
import { deviceInfo } from './deviceInfo';
import { parseDeviceInfo } from './deviceInfoParser';

const UA = {
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  safariIpad:
    'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  operaIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) OPT/4.6.0 Mobile/15E148',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70',
  windowsTabletPc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Tablet PC 2.0; rv:11.0) like Gecko',
  yandexWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 YaBrowser/24.6.0.0 Safari/537.36',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  firefoxAndroidTablet: 'Mozilla/5.0 (Android 13; Tablet; rv:133.0) Gecko/133.0 Firefox/133.0',
};

describe('parseDeviceInfo', () => {
  it.each([
    ['chromeMac', { name: 'macOS' }, { name: 'Chrome', version: '131' }, 'desktop'],
    ['safariMac', { name: 'macOS' }, { name: 'Safari', version: '17' }, 'desktop'],
    ['safariIphone', { name: 'iOS', version: '17.4' }, { name: 'Safari', version: '17' }, 'mobile'],
    ['safariIpad', { name: 'iPadOS', version: '16.6' }, { name: 'Safari', version: '16' }, 'tablet'],
    ['operaIphone', { name: 'iOS', version: '17.4' }, { name: 'Opera', version: '4' }, 'mobile'],
    ['edgeWindows', { name: 'Windows' }, { name: 'Edge', version: '131' }, 'desktop'],
    ['windowsTabletPc', { name: 'Windows' }, { name: 'Unknown' }, 'desktop'],
    ['yandexWindows', { name: 'Windows' }, { name: 'Yandex', version: '24' }, 'desktop'],
    ['firefoxLinux', { name: 'Linux' }, { name: 'Firefox', version: '133' }, 'desktop'],
    ['chromeAndroid', { name: 'android', version: '14' }, { name: 'Chrome', version: '131' }, 'mobile'],
    ['androidTablet', { name: 'android', version: '13' }, { name: 'Chrome', version: '131' }, 'tablet'],
    ['firefoxAndroidTablet', { name: 'android', version: '13' }, { name: 'Firefox', version: '133' }, 'tablet'],
  ] as const)('parses %s', (key, os, browser, formFactor) => {
    expect(parseDeviceInfo(UA[key], undefined, 0)).toEqual({ os, browser, formFactor });
  });

  it('detects iPadOS desktop-mode user agents via touch points', () => {
    expect(parseDeviceInfo(UA.safariMac, undefined, 5)).toEqual({
      os: { name: 'iPadOS', version: '17.4.1' },
      browser: { name: 'Safari', version: '17' },
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

  it('returns Unknown for unrecognized user agents', () => {
    expect(parseDeviceInfo('curl/8.0', undefined, 0)).toEqual({
      os: { name: 'Unknown' },
      browser: { name: 'Unknown' },
      formFactor: 'desktop',
    });
  });
});

describe('deviceInfo', () => {
  function run(options?: Parameters<typeof deviceInfo>[0]) {
    const controller = { setContext: jest.fn() } as unknown as jest.Mocked<Trackable.Controller>;
    deviceInfo(options)(controller);
    return controller.setContext.mock.calls[0][0];
  }

  it('sets all fields by default', () => {
    expect(run()).toEqual({
      os: expect.objectContaining({ name: expect.any(String) }),
      device: { form_factor: expect.any(String), touch: expect.any(Boolean) },
      browser: expect.objectContaining({ name: expect.any(String) }),
      locale: navigator.language.replace(/-/g, '_'),
      preferred_languages: [...navigator.languages],
      screen: { width: expect.any(Number), height: expect.any(Number), pixel_ratio: expect.any(Number) },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      timezone: expect.any(String),
    });
  });

  it('formats locale like the mobile SDKs', () => {
    jest.spyOn(navigator, 'language', 'get').mockReturnValue('sv-SE');
    expect(
      run({ os: false, device: false, browser: false, screen: false, viewport: false, timezone: false }).locale,
    ).toBe('sv_SE');
    jest.restoreAllMocks();
  });

  it('only sets the enabled fields', () => {
    expect(
      Object.keys(
        run({ device: false, browser: false, locale: false, screen: false, viewport: false, timezone: false }),
      ),
    ).toEqual(['os']);
  });
});
