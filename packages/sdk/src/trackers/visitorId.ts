import { Trackable } from '../Trackable';
import { Cookie, uuid } from '../utils';

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

    const hashedValue = generateUniqueId(value + clientSecret).toString();
    controller.setContext({ visitor_id: hashedValue });
  };

function generateUniqueId(inputString: string) {
  let hash = 5381;
  for (let i = 0; i < inputString.length; i++) {
    hash = (hash * 33) ^ inputString.charCodeAt(i);
  }
  // Convert hash to a hexadecimal string
  return hash >>> 0; // Ensure it's a non-negative number
}
