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
  return { controller, close, last: () => controller.setContext.mock.calls.at(-1)?.[0] as any };
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

  it('starts a new session when new campaign parameters arrive', async () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    const { last, close } = run(session());
    const before = last();

    history.pushState(null, '', '/?utm_source=ads');
    await Promise.resolve();
    expect(last().session_id).not.toEqual(before.session_id);
    expect(last().session_count).toBe(2);
    close();
  });

  it('keeps the session when navigating without or with the same campaign parameters', async () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    const { controller, close } = run(session());
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
