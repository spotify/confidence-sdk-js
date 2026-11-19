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
    matchMedia: () => ({ matches: false }),
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
      colorScheme: 'light',
      prefersReducedMotion: false,
      prefersContrast: 'no-preference',
      forcedColors: false,
    });
  });

  it.each([
    ['https://referrer.example/path?email=alice@example.com#token', 'https://referrer.example/path'],
    ['https://referrer.example/path#token?email=alice@example.com', 'https://referrer.example/path'],
    ['https://referrer.example/path?email=alice@example.com', 'https://referrer.example/path'],
    ['https://referrer.example/path#token', 'https://referrer.example/path'],
    ['', ''],
    ['invalid-url?email=alice@example.com#token', 'invalid-url'],
  ])('strips query/hash from referrer %s', (referrer, expected) => {
    stubBrowser({ document: { referrer } });
    expect(collectUserAgentContext()?.referrer).toBe(expected);
  });

  it('excludes query/hash from the initial document URI', () => {
    stubBrowser({
      window: {
        location: {
          origin: 'https://example.com',
          pathname: '/path',
          search: '?email=alice@example.com',
          hash: '#token',
          href: 'https://example.com/path?email=alice@example.com#token',
        },
      },
    });
    expect(collectUserAgentContext()?.uri).toBe('https://example.com/path');
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

  it('reports colorScheme dark when prefers-color-scheme matches', () => {
    stubBrowser({
      window: {
        matchMedia: (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' }),
      },
    });
    expect(collectUserAgentContext()?.colorScheme).toBe('dark');
  });

  it('reports prefersReducedMotion true when prefers-reduced-motion matches', () => {
    stubBrowser({
      window: {
        matchMedia: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
      },
    });
    expect(collectUserAgentContext()?.prefersReducedMotion).toBe(true);
  });

  it('reports prefersContrast more when prefers-contrast: more matches', () => {
    stubBrowser({
      window: {
        matchMedia: (query: string) => ({ matches: query === '(prefers-contrast: more)' }),
      },
    });
    expect(collectUserAgentContext()?.prefersContrast).toBe('more');
  });

  it('reports prefersContrast less when prefers-contrast: less matches', () => {
    stubBrowser({
      window: {
        matchMedia: (query: string) => ({ matches: query === '(prefers-contrast: less)' }),
      },
    });
    expect(collectUserAgentContext()?.prefersContrast).toBe('less');
  });

  it('reports forcedColors true when forced-colors: active matches', () => {
    stubBrowser({
      window: {
        matchMedia: (query: string) => ({ matches: query === '(forced-colors: active)' }),
      },
    });
    expect(collectUserAgentContext()?.forcedColors).toBe(true);
  });

  it('captures effectiveConnectionType from navigator.connection', () => {
    stubBrowser({ navigator: { connection: { effectiveType: '4g' } } });
    expect(collectUserAgentContext()?.effectiveConnectionType).toBe('4g');
  });

  it('omits effectiveConnectionType when navigator.connection is absent', () => {
    stubBrowser();
    expect(collectUserAgentContext()?.effectiveConnectionType).toBeUndefined();
  });

  it('falls back gracefully when matchMedia is unavailable', () => {
    stubBrowser({ window: { matchMedia: undefined } });
    const ctx = collectUserAgentContext();
    expect(ctx?.colorScheme).toBeUndefined();
    expect(ctx?.prefersReducedMotion).toBeUndefined();
    expect(ctx?.prefersContrast).toBeUndefined();
    expect(ctx?.forcedColors).toBeUndefined();
  });

  it('omits timeZone when Intl.DateTimeFormat throws', () => {
    stubBrowser();
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('embedded context with no Intl support');
    });
    expect(collectUserAgentContext()?.timeZone).toBeUndefined();
  });
});
