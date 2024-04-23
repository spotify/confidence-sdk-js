import { Trackable } from '../Trackable';

const COOKIE_NAME = 'cnfdVisitorId';

export const visitorIdentity = (): Trackable.Manager => controller => {
  if (typeof document === 'undefined') return;
  let value = getCookie(COOKIE_NAME);
  if (!value) {
    value = uuid();
    // TODO check correct cookie options
    setCookie(COOKIE_NAME, value, { maxAge: 60 * 60 * 24 * 365 * 5 });
  }
  controller.setContext({ visitor_id: value });
};

function uuid(): string {
  const HEX_ALPHA = '0123456789abcdef';
  return 'xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx'.replace(/x/g, () => HEX_ALPHA[(Math.random() * 16) | 0]);
}

type CookieOptions = {
  sameSite?: boolean;
  domain?: string;
  secure?: boolean;
  maxAge?: number;
  expires?: Date;
};
function setCookie(key: string, value: string, opt: CookieOptions = {}) {
  const parts = [`${encodeURIComponent(key)}=${encodeURIComponent(value)}`];
  if (opt.expires) {
    parts.push(`expires=${opt.expires.toUTCString()}`);
  } else if (typeof opt.maxAge === 'number') {
    parts.push(`expires=${new Date(Date.now() + opt.maxAge * 1000).toUTCString()}`);
  }
  if (opt.sameSite) {
    parts.push('samesite');
  }
  if (opt.domain) {
    parts.push(`domain=${encodeURIComponent(opt.domain)}`);
  }
  if (opt.secure) {
    parts.push('secure');
  }
  document.cookie = parts.join('; ');
}

export function getCookie(key: string): string | undefined {
  const prefix = `${encodeURIComponent(key)}=`;
  const documentCookie = document.cookie.split(/;\s*/g).find(cookie => cookie.startsWith(prefix));
  return documentCookie && decodeURIComponent(documentCookie.slice(prefix.length));
}

export function removeCookie(key: string) {
  setCookie(key, '', { maxAge: 0 });
}
