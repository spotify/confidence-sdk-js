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
  t[fnName] = function (...args: any): any {
    try {
      return originalFn.call(this, ...args);
    } finally {
      callback(...args);
    }
  };
  return () => {
    t[fnName] = originalFn;
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

export namespace Cookie {
  type Options = {
    sameSite?: boolean;
    domain?: string;
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

  export function remove(key: string) {
    set(key, '', { maxAge: 0 });
  }
}

export class MultiSet<T> implements Iterable<T> {
  readonly #entries: Map<T, number> = new Map();
  #size: number = 0;

  constructor(values: Iterable<T> = []) {
    for (const value of values) {
      this.add(value);
    }
  }
  count(value: T): number {
    return this.#entries.get(value) ?? 0;
  }
  add(value: T): this {
    this.#entries.set(value, this.count(value) + 1);
    this.#size++;
    return this;
  }
  clear(): void {
    this.#entries.clear();
    this.#size = 0;
  }
  delete(value: T): boolean {
    const count = this.count(value);
    if (count === 0) return false;
    if (count === 1) {
      this.#entries.delete(value);
    } else {
      this.#entries.set(value, count - 1);
    }
    this.#size--;
    return true;
  }
  forEach(callbackfn: (value: T, count: number, multiset: MultiSet<T>) => void, thisArg?: any): void {
    this.#entries.forEach((count, value) => callbackfn.call(thisArg, value, count, this));
  }
  has(value: T): boolean {
    return this.#entries.has(value);
  }
  get size(): number {
    return this.#size;
  }
  entries(): IterableIterator<[T, number]> {
    return this.#entries.entries();
  }
  values(): IterableIterator<T> {
    return this.#entries.keys();
  }
  [Symbol.iterator](): IterableIterator<T> {
    return this.values();
  }
}
