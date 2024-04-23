import { Trackable } from '../Trackable';
import { uuid, Cookie } from '../utils';

const COOKIE_NAME = 'cnfdVisitorId';

export const visitorIdentity = (): Trackable.Manager => controller => {
  if (typeof document === 'undefined') return;
  let value = Cookie.get(COOKIE_NAME);
  if (!value) {
    value = uuid();
    // TODO check correct cookie options
    Cookie.set(COOKIE_NAME, value, { maxAge: 60 * 60 * 24 * 365 * 5 });
  }
  controller.setContext({ visitor_id: value });
};
