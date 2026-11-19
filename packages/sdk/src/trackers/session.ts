import { Closer } from '../Closer';
import { Trackable } from '../Trackable';
import { Cookie, listenOn, spyOn, uuid } from '../utils';

const SESSION_COOKIE = 'cnfdSessionId';
const CAMPAIGN_COOKIE = 'cnfdCampaign';
const ACTIVITY_THROTTLE_MS = 1000;

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

/**
 * Options for the {@link session} and {@link campaign} trackers.
 * @public
 */
export type SessionOptions = {
  /**
   * Minutes of inactivity after which the session ends.
   * @defaultValue 30
   */
  timeout?: number;
  /** Set the cookie domain to share the session across subdomains (e.g. '.example.com'). */
  domain?: string;
};

function onActivity(callback: () => void): Closer {
  let last = 0;
  const throttled = () => {
    const now = Date.now();
    if (now - last < ACTIVITY_THROTTLE_MS) return;
    last = now;
    callback();
  };
  return Closer.combine(
    listenOn(document, 'pointerdown', throttled),
    listenOn(document, 'keydown', throttled),
    listenOn(window, 'scroll', throttled),
    listenOn(window, 'popstate', throttled),
    listenOn(window, 'hashchange', throttled),
    listenOn(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') throttled();
    }),
    spyOn(history, 'pushState', () => queueMicrotask(throttled)),
    spyOn(history, 'replaceState', () => queueMicrotask(throttled)),
  );
}

function cookieOptions({ timeout = 30, domain }: SessionOptions) {
  return domain ? { maxAge: timeout * 60, path: '/', domain } : { maxAge: timeout * 60, path: '/' };
}

/**
 * Adds a `session_id` to the context. A new session starts after `timeout` minutes without user
 * activity (pointer, keyboard, scroll, navigation or the page becoming visible).
 * @public
 */
export function session(options: SessionOptions = {}): Trackable.Manager {
  return controller => {
    if (typeof document === 'undefined') return undefined;
    let current: string | undefined;
    const refresh = () => {
      const id = Cookie.get(SESSION_COOKIE) || uuid();
      Cookie.set(SESSION_COOKIE, id, cookieOptions(options));
      if (id !== current) {
        current = id;
        controller.setContext({ session_id: id });
      }
    };
    refresh();
    return onActivity(refresh);
  };
}

type Utm = Partial<Record<(typeof UTM_PARAMS)[number], string>>;

function utmFromUrl(): Utm | undefined {
  const params = new URLSearchParams(location.search);
  const utm: Utm = {};
  for (const key of UTM_PARAMS) {
    const value = params.get(key);
    if (value) utm[key] = value;
  }
  return Object.keys(utm).length > 0 ? utm : undefined;
}

function utmFromCookie(): Utm | undefined {
  const raw = Cookie.get(CAMPAIGN_COOKIE);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return undefined;
  }
}

/**
 * Adds the UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) of
 * the landing URL to the context and keeps them until `timeout` minutes without user activity.
 * A URL with new UTM parameters replaces the stored ones.
 * @public
 */
export function campaign(options: SessionOptions = {}): Trackable.Manager {
  return controller => {
    if (typeof document === 'undefined') return undefined;
    let current = '';
    const refresh = () => {
      const utm = utmFromUrl() ?? utmFromCookie() ?? {};
      const serialized = JSON.stringify(utm);
      if (Object.keys(utm).length > 0) {
        Cookie.set(CAMPAIGN_COOKIE, serialized, cookieOptions(options));
      }
      if (serialized !== current) {
        current = serialized;
        const context: Record<string, string | undefined> = {};
        for (const key of UTM_PARAMS) context[key] = utm[key];
        controller.setContext(context);
      }
    };
    refresh();
    return onActivity(refresh);
  };
}
