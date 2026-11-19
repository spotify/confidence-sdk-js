/**
 * @jest-environment jsdom
 */
import { Trackable } from '../Trackable';
import { campaign, session } from './session';

function createController() {
  return { setContext: jest.fn() } as unknown as jest.Mocked<Trackable.Controller>;
}

function clearCookies() {
  for (const cookie of document.cookie.split(/;\s*/g)) {
    const name = cookie.split('=')[0];
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

beforeEach(() => {
  clearCookies();
  history.replaceState(null, '', '/');
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('session', () => {
  it('sets a session_id and keeps it within the timeout', () => {
    const first = createController();
    const close = session()(first) as () => void;
    const id = first.setContext.mock.calls[0][0].session_id;
    expect(id).toEqual(expect.any(String));
    close();

    jest.advanceTimersByTime(29 * 60 * 1000);
    const second = createController();
    (session()(second) as () => void)();
    expect(second.setContext).toHaveBeenCalledWith({ session_id: id });
  });

  it('sets the cookie to expire after the timeout', () => {
    const setCookie = jest.spyOn(document, 'cookie', 'set');
    (session({ timeout: 10, domain: '.example.com' })(createController()) as () => void)();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toUTCString();
    expect(setCookie).toHaveBeenCalledWith(expect.stringContaining(`expires=${expires}`));
    expect(setCookie).toHaveBeenCalledWith(expect.stringContaining('path=/'));
    expect(setCookie).toHaveBeenCalledWith(expect.stringContaining('domain=.example.com'));
    setCookie.mockRestore();
  });

  it('starts a new session once the cookie has expired', () => {
    const first = createController();
    (session()(first) as () => void)();
    const id = first.setContext.mock.calls[0][0].session_id;

    clearCookies();
    const second = createController();
    (session()(second) as () => void)();
    expect(second.setContext.mock.calls[0][0].session_id).not.toEqual(id);
  });

  it('extends the session on activity', () => {
    const controller = createController();
    const close = session({ timeout: 1 })(controller) as () => void;
    const id = controller.setContext.mock.calls[0][0].session_id;

    jest.advanceTimersByTime(50 * 1000);
    document.dispatchEvent(new Event('pointerdown'));
    jest.advanceTimersByTime(50 * 1000);
    document.dispatchEvent(new Event('pointerdown'));

    expect(controller.setContext).toHaveBeenCalledTimes(1);
    close();
    const next = createController();
    (session({ timeout: 1 })(next) as () => void)();
    expect(next.setContext).toHaveBeenCalledWith({ session_id: id });
  });
});

describe('campaign', () => {
  it('sets UTM parameters from the landing URL', () => {
    history.replaceState(null, '', '/?utm_source=newsletter&utm_campaign=fall&other=1');
    const controller = createController();
    (campaign()(controller) as () => void)();
    expect(controller.setContext).toHaveBeenCalledWith({
      utm_source: 'newsletter',
      utm_medium: undefined,
      utm_campaign: 'fall',
      utm_term: undefined,
      utm_content: undefined,
    });
  });

  it('keeps UTM parameters after navigating within the session', async () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    const controller = createController();
    const close = campaign()(controller) as () => void;
    jest.advanceTimersByTime(2000);
    history.pushState(null, '', '/pricing');
    await Promise.resolve();

    expect(controller.setContext).toHaveBeenCalledTimes(1);
    close();
    const next = createController();
    (campaign()(next) as () => void)();
    expect(next.setContext.mock.calls[0][0].utm_source).toBe('newsletter');
  });

  it('replaces stored UTM parameters with new ones from the URL', async () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    const controller = createController();
    const close = campaign()(controller) as () => void;
    jest.advanceTimersByTime(2000);
    history.pushState(null, '', '/?utm_source=ads');
    await Promise.resolve();

    expect(controller.setContext).toHaveBeenLastCalledWith(expect.objectContaining({ utm_source: 'ads' }));
    close();
  });

  it('drops UTM parameters once the cookie has expired', () => {
    history.replaceState(null, '', '/?utm_source=newsletter');
    (campaign()(createController()) as () => void)();
    history.replaceState(null, '', '/');
    clearCookies();

    const next = createController();
    (campaign()(next) as () => void)();
    expect(next.setContext.mock.calls[0][0].utm_source).toBeUndefined();
  });
});
