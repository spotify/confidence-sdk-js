import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const parse = vi.hoisted(() => vi.fn());

vi.mock('bowser', () => ({ default: { parse } }));

import { collectUserAgentContext } from './client-context';

function stubBrowser(
  overrides: {
    navigator?: Record<string, unknown>;
    window?: Record<string, unknown>;
    document?: Record<string, unknown>;
  } = {},
) {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0',
    language: 'en-US',
    ...overrides.navigator,
  });
  vi.stubGlobal('window', {
    location: { origin: 'https://example.com', pathname: '/path' },
    innerWidth: 1440,
    innerHeight: 900,
    screen: { width: 2560, height: 1440 },
    devicePixelRatio: 2,
    ...overrides.window,
  });
  vi.stubGlobal('document', {
    referrer: 'https://referrer.example/',
    ...overrides.document,
  });
}

describe('collectUserAgentContext', () => {
  beforeEach(() => {
    parse.mockImplementation(() => ({
      os: {},
      browser: {},
      platform: {},
      engine: {},
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns undefined in an SSR/Node context (no window)', () => {
    expect(collectUserAgentContext()).toBeUndefined();
  });

  it('returns undefined when window exists but navigator does not', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', undefined);
    expect(collectUserAgentContext()).toBeUndefined();
  });

  it('captures all fields from a populated env', () => {
    parse.mockReturnValueOnce({
      os: { name: 'macOS' },
      browser: { name: 'Chrome', version: '120.0.6099.225' },
      platform: { type: 'desktop' },
      engine: {},
    });
    stubBrowser();

    expect(collectUserAgentContext()).toMatchObject({
      userAgent: 'Mozilla/5.0',
      os: 'macos',
      browser: 'chrome',
      browserVersion: '120',
      mobile: false,
      languageCode: 'en-US',
      timeZone: expect.any(String),
      viewportWidth: 1440,
      viewportHeight: 900,
      screenWidth: 2560,
      screenHeight: 1440,
      devicePixelRatio: 2,
      uri: 'https://example.com/path',
      referrer: 'https://referrer.example/',
    });
  });

  it('flags `mobile` platform type as mobile=true', () => {
    parse.mockReturnValueOnce({
      os: {},
      browser: {},
      platform: { type: 'mobile' },
      engine: {},
    });
    stubBrowser();
    expect(collectUserAgentContext()?.mobile).toBe(true);
  });

  it('flags `tablet` platform type as mobile=true', () => {
    parse.mockReturnValueOnce({
      os: {},
      browser: {},
      platform: { type: 'tablet' },
      engine: {},
    });
    stubBrowser();
    expect(collectUserAgentContext()?.mobile).toBe(true);
  });

  it('omits os/browser/browserVersion/mobile when bowser returns nothing useful', () => {
    stubBrowser();
    const ctx = collectUserAgentContext();
    expect(ctx?.os).toBeUndefined();
    expect(ctx?.browser).toBeUndefined();
    expect(ctx?.browserVersion).toBeUndefined();
    expect(ctx?.mobile).toBeUndefined();
  });

  it('extracts major version from a full version string', () => {
    parse.mockReturnValueOnce({
      os: {},
      browser: { name: 'Safari', version: '17.4.1' },
      platform: {},
      engine: {},
    });
    stubBrowser();
    expect(collectUserAgentContext()?.browserVersion).toBe('17');
  });

  it('lowercases and strips whitespace from os/browser names', () => {
    parse.mockReturnValueOnce({
      os: { name: 'Chrome OS' },
      browser: { name: 'Microsoft Edge', version: '120.0.0' },
      platform: {},
      engine: {},
    });
    stubBrowser();
    const ctx = collectUserAgentContext();
    expect(ctx?.os).toBe('chromeos');
    expect(ctx?.browser).toBe('microsoftedge');
  });

  it('omits timeZone when Intl.DateTimeFormat throws', () => {
    stubBrowser();
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('embedded context with no Intl support');
    });
    expect(collectUserAgentContext()?.timeZone).toBeUndefined();
  });
});
