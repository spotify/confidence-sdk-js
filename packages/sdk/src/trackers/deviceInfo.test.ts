/**
 * @jest-environment jsdom
 */
import { Trackable } from '../Trackable';
import { deviceInfo } from './deviceInfo';
import { parseDeviceInfo } from './deviceInfoParser';

const UA = {
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.70',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

describe('parseDeviceInfo', () => {
  it.each([
    ['chromeMac', { name: 'macOS', version: '10.15.7' }, { name: 'Chrome', version: '131.0.0.0' }, 'desktop'],
    ['safariIphone', { name: 'iOS', version: '17.4' }, { name: 'Safari', version: '17.4' }, 'mobile'],
    ['edgeWindows', { name: 'Windows', version: '10.0' }, { name: 'Edge', version: '131.0.2903.70' }, 'desktop'],
    ['firefoxLinux', { name: 'Linux' }, { name: 'Firefox', version: '133.0' }, 'desktop'],
    ['chromeAndroid', { name: 'Android', version: '14' }, { name: 'Chrome', version: '131.0.0.0' }, 'mobile'],
    ['androidTablet', { name: 'Android', version: '13' }, { name: 'Chrome', version: '131.0.0.0' }, 'tablet'],
  ] as const)('parses %s', (key, os, browser, type) => {
    expect(parseDeviceInfo(UA[key])).toEqual({ os, browser, type });
  });

  it('prefers userAgentData brands for the browser', () => {
    const result = parseDeviceInfo(UA.chromeMac, {
      mobile: false,
      brands: [
        { brand: 'Not_A Brand', version: '8' },
        { brand: 'Chromium', version: '131' },
        { brand: 'Google Chrome', version: '131' },
      ],
    });
    expect(result.browser).toEqual({ name: 'Chrome', version: '131' });
  });

  it('returns Unknown for unrecognized user agents', () => {
    expect(parseDeviceInfo('curl/8.0')).toEqual({
      os: { name: 'Unknown' },
      browser: { name: 'Unknown' },
      type: 'desktop',
    });
  });
});

describe('deviceInfo', () => {
  it('sets device context', () => {
    const controller = { setContext: jest.fn() } as unknown as jest.Mocked<Trackable.Controller>;
    deviceInfo()(controller);
    expect(controller.setContext).toHaveBeenCalledWith({
      device: expect.objectContaining({
        os: expect.any(Object),
        browser: expect.any(Object),
        type: expect.any(String),
        touch: expect.any(Boolean),
        language: expect.any(String),
      }),
    });
  });
});
