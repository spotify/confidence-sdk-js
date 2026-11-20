/**
 * @jest-environment jsdom
 */
import { Trackable } from '../Trackable';
import { deviceInfo } from './deviceInfo';

const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

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

describe('deviceInfo', () => {
  function run(options?: Parameters<typeof deviceInfo>[0]) {
    const controller = { setContext: jest.fn() } as unknown as jest.Mocked<Trackable.Controller>;
    deviceInfo(options)(controller);
    return controller.setContext.mock.calls[0]?.[0];
  }

  it('sets all fields by default', () => {
    jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(SAFARI_IPHONE);
    jest.spyOn(navigator, 'language', 'get').mockReturnValue('sv-SE');
    jest.spyOn(navigator, 'languages', 'get').mockReturnValue(['sv-SE', 'en']);
    override(navigator, 'maxTouchPoints', 5);
    override(window, 'innerWidth', 393);
    override(window, 'innerHeight', 659);
    expect(run()).toEqual({
      os: { name: 'iOS', version: '17.4' },
      device: { form_factor: 'mobile', touch: true },
      browser: { name: 'Safari', version: '17' },
      locale: 'sv_SE',
      preferred_languages: ['sv-SE', 'en'],
      screen: { width: screen.width, height: screen.height, pixel_ratio: window.devicePixelRatio },
      viewport: { width: 393, height: 659 },
      timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it('skips the viewport when the page has no size yet', () => {
    override(window, 'innerWidth', 0);
    expect(run()).not.toHaveProperty('viewport');
  });

  it('only sets the enabled fields', () => {
    expect(
      Object.keys(
        run({ device: false, browser: false, locale: false, screen: false, viewport: false, timezone: false }),
      ),
    ).toEqual(['os']);
  });

  it('does nothing outside the browser', () => {
    override(globalThis, 'navigator', undefined);
    expect(run()).toBeUndefined();
  });
});
