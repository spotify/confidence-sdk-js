type CleanupFn = () => void;
type PickFn<T> = {
  [K in keyof Required<T> as T[K] extends (...args: any) => any ? K : never]: T[K] extends (...args: any) => any
    ? T[K]
    : never;
};

export function spyOn<T extends {}, N extends keyof PickFn<T>>(
  target: T,
  fnName: N,
  callback: (...args: Parameters<PickFn<T>[N]>) => void,
): CleanupFn {
  const t = target as any;
  const originalFn = t[fnName];
  let active = true;
  // eslint-disable-next-line func-names
  const wrapper = function (this: unknown, ...args: any): any {
    try {
      return originalFn.call(this, ...args);
    } finally {
      if (active) callback(...args);
    }
  };
  t[fnName] = wrapper;
  return () => {
    active = false;
    // Only unwrap when no other spy was added on top; otherwise this wrapper stays as a pass-through
    // so spies can be closed in any order.
    if (t[fnName] === wrapper) t[fnName] = originalFn;
  };
}

export function listenOn(target: EventTarget, type: string, listener: (e: Event) => void): CleanupFn {
  target.addEventListener(type, listener);
  return () => {
    target.removeEventListener(type, listener);
  };
}

export function uuid(): string {
  const HEX_ALPHA = '0123456789abcdef';
  return 'xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx'.replace(/x/g, () => HEX_ALPHA[(Math.random() * 16) | 0]);
}

export function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

export function withApiV1(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/v1`;
}

export namespace Cookie {
  type Options = {
    sameSite?: boolean;
    domain?: string;
    path?: string;
    secure?: boolean;
    maxAge?: number;
    expires?: Date;
  };
  export function set(key: string, value: string, opt: Options = {}) {
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
    if (opt.path) {
      parts.push(`path=${encodeURI(opt.path)}`);
    }
    if (opt.secure) {
      parts.push('secure');
    }
    document.cookie = parts.join('; ');
  }

  export function get(key: string): string | undefined {
    const prefix = `${encodeURIComponent(key)}=`;
    const documentCookie = document.cookie.split(/;\s*/g).find(cookie => cookie.startsWith(prefix));
    return documentCookie && decodeURIComponent(documentCookie.slice(prefix.length));
  }

  export function remove(key: string, opt: Pick<Options, 'domain' | 'path'> = {}) {
    set(key, '', { ...opt, maxAge: 0 });
  }
}
