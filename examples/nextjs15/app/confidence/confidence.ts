import { AccessiblePromise } from './AccessiblePromise';

export type Context = Record<string, any>;

export type Flags = Record<string, any>;

type Cache = Record<string, AccessiblePromise<Flags>>;

type Data = { cache?: Cache; context?: Context };
export class Confidence {
  private context: Context = {};
  private cache: Cache = {};
  private onChangeListeners = new Set<() => void>();

  constructor({ cache = {}, context = {} }: Data = {}) {
    this.cache = cache;
    this.context = context;
    this.resolve();
  }

  setContext(ctx: Context) {
    this.context = ctx;
    this.resolve();
  }

  withContext(context: Context) {
    return new Confidence({ cache: this.cache, context });
  }
  getFlag<T>(name: string, defaultValue: T): AccessiblePromise<T> {
    const key = JSON.stringify(this.context);
    let cached = this.cache[key];
    if (!cached) {
      console.log('resolving for', key);
      cached = this.cache[key] = AccessiblePromise.resolve(fetchFlags(this.context));
    }
    return cached.then(flags => (flags[name] as T) ?? defaultValue);
  }

  subscribe(onChange: () => void): () => void {
    this.onChangeListeners.add(onChange);
    return () => {
      this.onChangeListeners.delete(onChange);
    };
  }

  toJSON() {
    return { ...this };
  }

  private resolve() {
    const key = JSON.stringify(this.context);
    const flags = (this.cache[key] = AccessiblePromise.resolve(fetchFlags(this.context)));
    flags.then(() => {
      this.onChangeListeners.forEach(listener => listener());
    });
  }
}

async function fetchFlags(ctx: Context): Promise<Flags> {
  console.log('fetchFlags', ctx);
  await sleep(1000);
  if (typeof ctx.userId === 'string') {
    if (ctx.userId.startsWith('a')) {
      return {
        pantsColor: 'blue',
      };
    }
    return {
      pantsColor: 'red',
    };
  }
  return {};
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isServer(): boolean {
  return typeof window === 'undefined';
}
