import { AccessiblePromise } from './AccessiblePromise';

export type Context = Record<string, any>;

export type Flags = Record<string, any>;

type Cache = Record<string, AccessiblePromise<Flags>>;

type Data = { cache?: Cache; context?: Context };
export class Confidence {
  private context: Context = {};
  cache: Cache = {};

  constructor({ cache = {}, context = {} }: Data = {}) {
    this.cache = cache;
    this.context = context;
    const key = JSON.stringify(this.context);
    if (!this.cache[key]) {
      this.cache[key] = AccessiblePromise.resolve(fetchFlags(this.context));
    }
  }

  setContext(ctx: Context) {
    this.context = ctx;
    const key = JSON.stringify(this.context);
    this.cache[key] = AccessiblePromise.resolve(fetchFlags(this.context));
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

  toJSON() {
    return { ...this };
  }
}

async function fetchFlags(ctx: Context): Promise<Flags> {
  await sleep(1000);
  if (ctx.userId) {
    if (ctx.userId === 'a') {
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
