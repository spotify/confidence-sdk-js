import { Trackable } from '../Trackable';
import { uuid, Cookie } from '../utils';

const COOKIE_NAME = 'cnfdVisitorId';

/**
 * Options for the visitor identity tracker.
 * @public
 */
export type VisitorIdentityOptions = {
  /** Set the cookie domain to share the visitor ID across subdomains (e.g. '.example.com'). */
  domain?: string;
};

/**
 * Visitor Identity which can be used in Cookies
 * @public  */
export const visitorIdentity =
  ({ domain }: VisitorIdentityOptions = {}): Trackable.Manager =>
  controller => {
    if (typeof document === 'undefined') return;
    const cookieOptions: Parameters<typeof Cookie.set>[2] = { maxAge: 60 * 60 * 24 * 365 * 5 };
    if (domain) {
      cookieOptions.domain = domain;
    }
    let value = Cookie.get(COOKIE_NAME);
    if (!value) {
      value = uuid();
    }
    Cookie.set(COOKIE_NAME, value, cookieOptions);
    controller.setContext({ visitor_id: value });
  };
