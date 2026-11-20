import { Closer } from '../Closer';
import { Trackable } from '../Trackable';
import { Cookie, listenOn, spyOn, uuid } from '../utils';

const SESSION_COOKIE = 'cnfdSession';
const SESSION_COUNT_COOKIE = 'cnfdSessionCount';
const CAMPAIGN_COOKIE = 'cnfdCampaign';
const FIRST_CAMPAIGN_COOKIE = 'cnfdFirstCampaign';
const ACTIVITY_THROTTLE_MS = 1000;
const SESSION_COUNT_MAX_AGE_DAYS = 365;
// Keeps the URI-encoded cookies well below the 4 KB browser limit.
const MAX_VALUE_LENGTH = 100;
const DAY_SECONDS = 24 * 60 * 60;

const DEFAULT_CAMPAIGN_PARAMS = [
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
] as const;

/**
 * Options for the {@link session} tracker.
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
  /**
   * URL parameters that identify a campaign. `utm_term`, `utm_content` can hold free text and the
   * click IDs identify individual users, so remove any you don't want stored in cookies and sent
   * with flag resolves and events.
   * @defaultValue `['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'gclid', 'fbclid', 'msclkid', 'li_fat_id']`
   */
  params?: readonly string[];
  /**
   * Start a new session when the URL has campaign parameters (from `params`) different from those
   * that started the current session, like Universal Analytics did. Off by default, matching GA4 and
   * Amplitude, where a campaign change mid-session keeps the session.
   * @defaultValue false
   */
  newSessionOnCampaign?: boolean;
};

/**
 * Options for the {@link campaign} tracker.
 * @public
 */
export type CampaignOptions = Omit<SessionOptions, 'newSessionOnCampaign'> & {
  /**
   * Days to keep the first touch in `first_campaign`, or `false` to not track the first touch.
   * @defaultValue 90
   */
  firstTouch?: number | false;
};

type Params = Record<string, string>;
type Touch = Record<string, string>;
type StoredSession = { id: string; start: string; count: number; params?: string };

// Leading-edge throttle: activity within a second of the last handled one is dropped, which only
// delays extending the cookies by at most a second.
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
    // Navigations always count, so a URL with new campaign parameters is never throttled away.
    spyOn(history, 'pushState', () => queueMicrotask(callback)),
    spyOn(history, 'replaceState', () => queueMicrotask(callback)),
  );
}

function cookieOptions(maxAge: number, domain?: string) {
  return domain ? { maxAge, path: '/', domain } : { maxAge, path: '/' };
}

function readJson<T>(name: string): T | undefined {
  const raw = Cookie.get(name);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return undefined;
  }
}

function paramsFromUrl(keys: readonly string[]): Params | undefined {
  const search = new URLSearchParams(location.search);
  const params: Params = {};
  for (const key of keys) {
    const value = search.get(key);
    if (value) params[key] = value.slice(0, MAX_VALUE_LENGTH);
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

function externalReferrer(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const url = new URL(document.referrer);
    if (url.host === location.host) return undefined;
    // Query and fragment are dropped as they may contain personal data.
    return `${url.origin}${url.pathname}`.slice(0, MAX_VALUE_LENGTH);
  } catch (e) {
    return undefined;
  }
}

function paramsKey(params: Params | undefined, keys: readonly string[]): string {
  const values: Params = {};
  for (const key of keys) {
    if (params?.[key]) values[key] = params[key];
  }
  return JSON.stringify(values);
}

/** Calls `onExpire` when `cookie` has expired, rescheduling while other tabs keep extending it. */
function expiryTimer(cookie: string, timeoutMs: number, onExpire: () => void) {
  let id: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    if (Cookie.get(cookie)) {
      id = setTimeout(check, timeoutMs);
    } else {
      onExpire();
    }
  };
  return {
    reset() {
      clearTimeout(id);
      // One extra second so the browser has dropped the cookie when we check.
      id = setTimeout(check, timeoutMs + 1000);
    },
    stop() {
      clearTimeout(id);
    },
  };
}

/**
 * Adds `session_id`, `session_start` (ISO timestamp) and `session_count` (number of sessions of
 * this browser) to the context. A new session starts after `timeout` minutes without user activity
 * (pointer, keyboard, scroll, navigation or the page becoming visible), and, with
 * `newSessionOnCampaign`, when the URL has campaign parameters (UTM or click IDs) different from
 * those that started the current session.
 *
 * @remarks
 * When the session expires the session fields are removed from the context, and a new session
 * starts on the next activity.
 * @public
 */
export function session(options: SessionOptions = {}): Trackable.Manager {
  const { timeout = 30, domain, params: keys = DEFAULT_CAMPAIGN_PARAMS, newSessionOnCampaign = false } = options;
  return controller => {
    if (typeof document === 'undefined') return undefined;
    let current: string | undefined;
    const expiry = expiryTimer(SESSION_COOKIE, timeout * 60 * 1000, () => {
      current = undefined;
      controller.setContext({ session_id: undefined, session_start: undefined, session_count: undefined });
    });
    const refresh = () => {
      let stored = readJson<StoredSession>(SESSION_COOKIE);
      const urlParams = newSessionOnCampaign ? paramsFromUrl(keys) : undefined;
      const params = urlParams && paramsKey(urlParams, keys);
      if (!stored || (params && params !== stored.params)) {
        const count = (Number(Cookie.get(SESSION_COUNT_COOKIE)) || 0) + 1;
        Cookie.set(
          SESSION_COUNT_COOKIE,
          String(count),
          cookieOptions(SESSION_COUNT_MAX_AGE_DAYS * DAY_SECONDS, domain),
        );
        stored = { id: uuid(), start: new Date().toISOString(), count, ...(params && { params }) };
      }
      Cookie.set(SESSION_COOKIE, JSON.stringify(stored), cookieOptions(timeout * 60, domain));
      expiry.reset();
      if (stored.id !== current) {
        current = stored.id;
        controller.setContext({ session_id: stored.id, session_start: stored.start, session_count: stored.count });
      }
    };
    refresh();
    return Closer.combine(onActivity(refresh), expiry.stop);
  };
}

/**
 * Adds how the visitor arrived to the context: `campaign` for the current visit and, unless
 * disabled, `first_campaign` for the first visit. Each holds the campaign parameters (by default
 * the UTM parameters including `utm_id`, and the click IDs `gclid`, `fbclid`, `msclkid`,
 * `li_fat_id`), the external `referrer` (without query) and the `landing_page` path.
 *
 * @remarks
 * `campaign` is kept until `timeout` minutes without user activity, then removed from the context.
 * A URL with different campaign parameters replaces it; a new referrer alone does not, so returning
 * from e.g. a login or payment page keeps the original campaign. The referrer is only known for the
 * page load, so campaigns that start later (e.g. after client-side navigation) have no referrer.
 * @public
 */
export function campaign(options: CampaignOptions = {}): Trackable.Manager {
  const { timeout = 30, domain, firstTouch = 90, params: keys = DEFAULT_CAMPAIGN_PARAMS } = options;
  return controller => {
    if (typeof document === 'undefined') return undefined;
    let current = '';
    let pageLoad = true;
    const expiry = expiryTimer(CAMPAIGN_COOKIE, timeout * 60 * 1000, () => {
      current = '';
      controller.setContext({ campaign: undefined });
    });
    const refresh = () => {
      const stored = readJson<Touch>(CAMPAIGN_COOKIE);
      const urlParams = paramsFromUrl(keys);
      let touch: Touch;
      if (!stored || (urlParams && paramsKey(urlParams, keys) !== paramsKey(stored, keys))) {
        touch = { ...urlParams };
        const referrer = pageLoad ? externalReferrer() : undefined;
        if (referrer) touch.referrer = referrer;
        touch.landing_page = location.pathname.slice(0, MAX_VALUE_LENGTH);
      } else {
        touch = stored;
      }
      pageLoad = false;
      Cookie.set(CAMPAIGN_COOKIE, JSON.stringify(touch), cookieOptions(timeout * 60, domain));
      expiry.reset();

      let first: Touch | undefined;
      if (firstTouch !== false) {
        first = readJson<Touch>(FIRST_CAMPAIGN_COOKIE);
        if (!first) {
          first = touch;
          Cookie.set(FIRST_CAMPAIGN_COOKIE, JSON.stringify(first), cookieOptions(firstTouch * DAY_SECONDS, domain));
        }
      }

      const serialized = JSON.stringify([touch, first]);
      if (serialized !== current) {
        current = serialized;
        controller.setContext(first ? { campaign: touch, first_campaign: first } : { campaign: touch });
      }
    };
    refresh();
    return Closer.combine(onActivity(refresh), expiry.stop);
  };
}
