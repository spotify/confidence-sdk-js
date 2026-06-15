import { Trackable } from '../Trackable';
import { uuid, Cookie } from '../utils';

const COOKIE_NAME = 'cnfdVisitorId';
const MAX_AGE = 60 * 60 * 24 * 365 * 5;

/**
 * Options for the visitor identity tracker.
 * @public
 */
export type VisitorIdentityOptions = {
  /** Set the cookie domain to share the visitor ID across subdomains (e.g. '.example.com'). */
  domain?: string;
};

interface CookieStoreEntry {
  name: string;
  value: string;
  domain: string;
}

interface CookieStore {
  getAll(name: string): Promise<CookieStoreEntry[]>;
  delete(options: { name: string; domain: string }): Promise<void>;
}

declare const cookieStore: CookieStore | undefined;

function normalizeDomain(d: string): string {
  return d.startsWith('.') ? d.slice(1) : d;
}

async function migrateWithCookieStore(
  name: string,
  currentValue: string,
  domain: string,
  controller: Trackable.Controller,
): Promise<void> {
  try {
    const cookies = await cookieStore!.getAll(name);
    const normalizedDomain = normalizeDomain(domain);
    const domainCookie = cookies.find(c => normalizeDomain(c.domain) === normalizedDomain);
    const hostCookies = cookies.filter(c => c !== domainCookie);

    for (const cookie of hostCookies) {
      await cookieStore!.delete({ name, domain: cookie.domain });
    }

    if (domainCookie) {
      if (domainCookie.value !== currentValue) {
        controller.setContext({ visitor_id: domainCookie.value });
      }
    } else {
      Cookie.set(name, currentValue, { maxAge: MAX_AGE, domain });
    }
  } catch (_e) {
    Cookie.set(name, currentValue, { maxAge: MAX_AGE, domain });
  }
}

/**
 * Visitor Identity which can be used in Cookies
 * @public  */
export const visitorIdentity =
  ({ domain }: VisitorIdentityOptions = {}): Trackable.Manager =>
  controller => {
    if (typeof document === 'undefined') return;

    let value = Cookie.get(COOKIE_NAME);
    if (!value) {
      value = uuid();
    }
    controller.setContext({ visitor_id: value });

    if (!domain) {
      Cookie.set(COOKIE_NAME, value, { maxAge: MAX_AGE });
      return;
    }

    if (typeof cookieStore !== 'undefined') {
      migrateWithCookieStore(COOKIE_NAME, value, domain, controller);
    } else {
      Cookie.set(COOKIE_NAME, value, { maxAge: MAX_AGE, domain });
    }
  };
