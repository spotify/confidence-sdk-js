/**
 * @jest-environment jsdom
 */
import { Trackable } from '../Trackable';
import { campaign, session } from './session';

function createController() {
  return { setContext: jest.fn() } as unknown as jest.Mocked<Trackable.Controller>;
}

function run(manager: Trackable.Manager) {
  const controller = createController();
  const close = manager(controller) as () => void;
  return {
    controller,
    close,
    last: () => controller.setContext.mock.calls[controller.setContext.mock.calls.length - 1]?.[0] as any,
  };
}

function clearCookies(...names: string[]) {
  for (const cookie of document.cookie.split(/;\s*/g)) {
    const name = cookie.split('=')[0];
    if (name && (names.length === 0 || names.includes(name))) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

function setReferrer(value: string) {
  jest.spyOn(document, 'referrer', 'get').mockReturnValue(value);
}

beforeEach(() => {
  clearCookies();
  history.replaceState(null, '', '/');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('session', () => {
  it('sets session_id, session_start and session_count', () => {
    const { last, close } = run(session());
    expect(last()).toEqual({
      session_id: expect.any(String),
      session_start: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      session_count: 1,
    });
    close();
  });

  it('keeps the session across page loads within the timeout', () => {
    const first = run(session());
    first.close();
    const second = run(session());
    expect(second.last()).toEqual(first.last());
    second.close();
  });

  it('sets the session cookie to expire after the timeout', () => {
    const setCookie = jest.spyOn(document, 'cookie', 'set');
    run(session({ timeout: 10, domain: '.example.com' })).close();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toUTCString();
    const sessionCookie = setCookie.mock.calls.map(([value]) => value).find(value => value.startsWith('cnfdSession='));
    expect(sessionCookie).toContain(`expires=${expires}`);
    expect(sessionCookie).toContain('path=/');
    expect(sessionCookie).toContain('domain=.example.com');
  });

  it('starts a new session and increments the count once the session has expired', () => {
    const first = run(session());
    first.close();
    clearCookies('cnfdSession');
    const second = run(session());
    expect(second.last().session_id).not.toEqual(first.last().session_id);
    expect(second.last().session_count).toBe(2);
    second.close();
  });

  it('keeps the session when new campaign parameters arrive by default', async () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    const { controller, close } = run(session());
    history.pushState(null, '', '/?utm_source=ads');
    await Promise.resolve();
    expect(controller.setContext).toHaveBeenCalledTimes(1);
    close();
  });

  it('starts a new session when new campaign parameters arrive with newSessionOnCampaign', async () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    const { last, close } = run(session({ newSessionOnCampaign: true }));
    const before = last();

    history.pushState(null, '', '/?utm_source=ads');
    await Promise.resolve();
    expect(last().session_id).not.toEqual(before.session_id);
    expect(last().session_count).toBe(2);
    close();
  });

  it('keeps the session when navigating without or with the same campaign parameters', async () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    const { controller, close } = run(session({ newSessionOnCampaign: true }));
    history.pushState(null, '', '/pricing');
    history.pushState(null, '', '/?utm_source=newsletter');
    await Promise.resolve();
    expect(controller.setContext).toHaveBeenCalledTimes(1);
    close();
  });
});

describe('campaign', () => {
  it('sets UTM parameters, click IDs, referrer and landing page', () => {
    setReferrer('https://www.google.com/search?q=secret');
    history.replaceState(null, '', '/pricing?utm_source=google&utm_id=42&gclid=abc&other=1');
    const { last, close } = run(campaign());
    const expected = {
      utm_source: 'google',
      utm_id: '42',
      gclid: 'abc',
      referrer: 'https://www.google.com/search',
      landing_page: '/pricing',
    };
    expect(last()).toEqual({ campaign: expected, first_campaign: expected });
    close();
  });

  it('records direct and referral visits without campaign parameters', () => {
    setReferrer('https://news.example.org/article');
    history.replaceState(null, '', '/blog');
    const { last, close } = run(campaign());
    expect(last().campaign).toEqual({ referrer: 'https://news.example.org/article', landing_page: '/blog' });
    close();
  });

  it('ignores same-site referrers', () => {
    setReferrer(`${location.origin}/other`);
    const { last, close } = run(campaign());
    expect(last().campaign).toEqual({ landing_page: '/' });
    close();
  });

  it('keeps the campaign after navigating and when returning from another site', () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    run(campaign()).close();

    setReferrer('https://login.example.com/callback');
    history.replaceState(null, '', '/dashboard');
    const { last, close } = run(campaign());
    expect(last().campaign).toEqual({ utm_source: 'newsletter', landing_page: '/' });
    close();
  });

  it('replaces the campaign but keeps the first touch when new parameters arrive', async () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    const { last, close } = run(campaign());

    history.pushState(null, '', '/offer?utm_source=ads');
    await Promise.resolve();
    expect(last()).toEqual({
      campaign: { utm_source: 'ads', landing_page: '/offer' },
      first_campaign: { utm_source: 'newsletter', landing_page: '/' },
    });
    close();
  });

  it('keeps the first touch after the campaign has expired', () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    run(campaign()).close();
    clearCookies('cnfdCampaign');

    history.replaceState(null, '', '/later');
    const { last, close } = run(campaign());
    expect(last()).toEqual({
      campaign: { landing_page: '/later' },
      first_campaign: { utm_source: 'newsletter', landing_page: '/' },
    });
    close();
  });

  it('sets the first touch cookie to expire after the configured days', () => {
    const setCookie = jest.spyOn(document, 'cookie', 'set');
    run(campaign({ firstTouch: 7 })).close();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
    const firstCookie = setCookie.mock.calls
      .map(([value]) => value)
      .find(value => value.startsWith('cnfdFirstCampaign='));
    expect(firstCookie).toContain(`expires=${expires}`);
  });

  it('does not track the first touch when disabled', () => {
    const { last, close } = run(campaign({ firstTouch: false }));
    expect(last()).toEqual({ campaign: { landing_page: '/' } });
    expect(document.cookie).not.toContain('cnfdFirstCampaign');
    close();
  });
});

describe('activity', () => {
  function expiresOf(setCookie: jest.SpyInstance, name: string) {
    const calls = setCookie.mock.calls.map(([value]) => value as string).filter(value => value.startsWith(`${name}=`));
    return calls[calls.length - 1]?.match(/expires=([^;]+)/)?.[1];
  }

  beforeEach(() => {
    // jsdom expires cookies on the real clock, so the fake clock starts at the real time.
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'], now: Date.now() });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ['pointerdown', () => document.dispatchEvent(new Event('pointerdown'))],
    ['keydown', () => document.dispatchEvent(new Event('keydown'))],
    ['scroll', () => window.dispatchEvent(new Event('scroll'))],
    [
      'visibilitychange',
      () => {
        jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
        document.dispatchEvent(new Event('visibilitychange'));
      },
    ],
  ])('extends the session cookie on %s', (_, fire) => {
    const setCookie = jest.spyOn(document, 'cookie', 'set');
    const { close } = run(session({ timeout: 30 }));
    const start = Date.now();
    jest.setSystemTime(start + 10 * 60 * 1000);
    fire();
    expect(expiresOf(setCookie, 'cnfdSession')).toBe(new Date(start + 40 * 60 * 1000).toUTCString());
    close();
  });

  it('handles at most one activity per second', () => {
    const setCookie = jest.spyOn(document, 'cookie', 'set');
    const { close } = run(session());
    document.dispatchEvent(new Event('pointerdown'));
    const writes = setCookie.mock.calls.length;
    jest.advanceTimersByTime(500);
    document.dispatchEvent(new Event('pointerdown'));
    expect(setCookie.mock.calls.length).toBe(writes);
    jest.advanceTimersByTime(600);
    document.dispatchEvent(new Event('pointerdown'));
    expect(setCookie.mock.calls.length).toBeGreaterThan(writes);
    close();
  });

  it('removes the session from the context once it has expired', () => {
    const { last, close } = run(session({ timeout: 1 }));
    clearCookies('cnfdSession');
    jest.advanceTimersByTime(61 * 1000);
    expect(last()).toEqual({ session_id: undefined, session_start: undefined, session_count: undefined });
    close();
  });

  it('keeps the session while another tab extends the cookie', () => {
    const { controller, close } = run(session({ timeout: 1 }));
    const value = document.cookie.match(/cnfdSession=([^;]+)/)![1];
    jest.advanceTimersByTime(50 * 1000);
    document.cookie = `cnfdSession=${value}; expires=${new Date(Date.now() + 60 * 1000).toUTCString()}; path=/`;
    jest.advanceTimersByTime(30 * 1000);
    expect(controller.setContext).toHaveBeenCalledTimes(1);
    close();
  });

  it('removes the campaign but keeps the first touch once the campaign has expired', () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    const { last, close } = run(campaign({ timeout: 1 }));
    clearCookies('cnfdCampaign');
    jest.advanceTimersByTime(61 * 1000);
    expect(last()).toEqual({ campaign: undefined });
    close();
  });

  it('stops listening once closed', async () => {
    const { controller, close } = run(session());
    close();
    clearCookies();
    jest.advanceTimersByTime(2000);
    document.dispatchEvent(new Event('pointerdown'));
    history.pushState(null, '', '/?utm_source=ads');
    await Promise.resolve();
    jest.advanceTimersByTime(60 * 60 * 1000);
    expect(controller.setContext).toHaveBeenCalledTimes(1);
  });
});

describe('campaign referrer', () => {
  it('does not reuse the page load referrer for campaigns that start later', async () => {
    setReferrer('https://www.google.com/');
    const { last, close } = run(campaign());
    expect(last().campaign.referrer).toBe('https://www.google.com/');

    history.pushState(null, '', '/offer?utm_source=ads');
    await Promise.resolve();
    expect(last().campaign).toEqual({ utm_source: 'ads', landing_page: '/offer' });
    close();
  });
});

describe('params option', () => {
  it('only captures the configured parameters', () => {
    history.replaceState(null, '', '/?utm_source=google&utm_term=private&gclid=abc&ttclid=xyz');
    const { last, close } = run(campaign({ params: ['utm_source', 'ttclid'] }));
    expect(last().campaign).toEqual({ utm_source: 'google', ttclid: 'xyz', landing_page: '/' });
    close();
  });

  it('ignores parameters that are not configured when deciding on a new session', async () => {
    history.replaceState(null, '', '/?utm_source=google');
    const { controller, close } = run(session({ params: ['utm_source'], newSessionOnCampaign: true }));
    history.pushState(null, '', '/?utm_source=google&gclid=abc');
    await Promise.resolve();
    expect(controller.setContext).toHaveBeenCalledTimes(1);
    close();
  });
});

describe('cookie size', () => {
  it('keeps the campaign cookie under the browser limit with every value at its maximum', () => {
    const long = 'x'.repeat(1000);
    const query = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'utm_id',
      'gclid',
      'fbclid',
      'msclkid',
      'li_fat_id',
    ]
      .map(key => `${key}=${long}`)
      .join('&');
    setReferrer(`https://example.org/${long}`);
    history.replaceState(null, '', `/${long}?${query}`);
    const setCookie = jest.spyOn(document, 'cookie', 'set');
    run(campaign()).close();
    const cookie = setCookie.mock.calls
      .map(([value]) => value as string)
      .find(value => value.startsWith('cnfdCampaign='));
    expect(cookie!.length).toBeLessThan(4096);
  });
});
