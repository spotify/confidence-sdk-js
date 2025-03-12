import { AccessiblePromise } from './AccessiblePromise';
import { Context } from './context';
import { ResolveFlagsResponse } from './generated/confidence/flags/resolver/v1/api';
import { Value } from './Value';

export type CacheEntry = [string, number, Uint8Array];
export type CacheScope = (provider: CacheProvider) => CacheProvider;
// TODO make CacheProvider take the clientKey
export type CacheProvider = () => FlagCache;
export interface CacheOptions {
  ttl?: number;
  scope?: CacheScope;
  entries?: Iterable<CacheEntry>;
}

type CacheValue = { timestamp: number; response: Promise<ResolveFlagsResponse> };
export class FlagCache {
  private readonly data: Map<string, CacheValue> = new Map();
  private constructor(
    private ttl: number,
    entries: Iterable<CacheEntry> = [],
  ) {
    for (const [key, timestamp, data] of entries) {
      this.data.set(key, { timestamp, response: AccessiblePromise.resolve(ResolveFlagsResponse.decode(data)) });
    }
  }

  get(context: Context, supplier: (context: Context) => Promise<ResolveFlagsResponse>): Promise<ResolveFlagsResponse> {
    const key = Value.serialize(context);
    let entry = this.data.get(key);
    if (!entry) {
      entry = { timestamp: Date.now(), response: supplier(context) };
      this.data.set(key, entry);
    }
    return entry.response;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<CacheEntry> {
    for (const [key, { timestamp, response }] of this.data) {
      yield [key, timestamp, ResolveFlagsResponse.encode(await response).finish()];
    }
  }

  // evict() {
  //   const deadline = Date.now() - this.ttl;
  //   for (const [key, { timestamp }] of this.data.entries()) {
  //     if (timestamp > deadline) return;
  //     this.data.delete(key);
  //   }
  // }

  async toOptions(): Promise<CacheOptions> {
    return {
      ttl: this.ttl,
      entries: await arrayFromAsync(this),
    };
  }

  static provider({ scope = defaultScope(), ttl = Infinity, entries }: CacheOptions): CacheProvider | undefined {
    const provider = () => new FlagCache(ttl, entries);
    return scope(provider);
  }
}

export const singletonScope: CacheScope = provider => {
  let cache: FlagCache | undefined;
  return () => {
    if (!cache) {
      cache = provider();
    }
    return cache;
  };
};

export const noScope = (provider: CacheProvider) => provider;

function defaultScope(): CacheScope {
  return typeof window === 'undefined' ? noScope : singletonScope;
}

async function arrayFromAsync<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result = [];
  for await (const value of iterable) {
    result.push(value);
  }
  return result;
}
