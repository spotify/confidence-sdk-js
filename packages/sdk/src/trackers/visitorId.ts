import { Trackable } from '../Trackable';
import { Cookie, uuid } from '../utils';
import { sha256 } from 'js-sha256';

const COOKIE_NAME = 'cnfdVisitorId';

export const visitorIdentity =
  (clientSecret: string): Trackable.Manager =>
  controller => {
    if (typeof document === 'undefined') return;
    let value = Cookie.get(COOKIE_NAME);
    if (!value) {
      value = uuid();
      // TODO check correct cookie options
      Cookie.set(COOKIE_NAME, value, { maxAge: 60 * 60 * 24 * 365 * 5 });
    }

    const hashedValue = sha256(value + clientSecret).toString();
    controller.setContext({ visitor_id: hashedValue });
  };
