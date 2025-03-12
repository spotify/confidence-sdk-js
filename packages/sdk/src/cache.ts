import { AccessiblePromise } from './AccessiblePromise';
import { Context } from './context';
import { ResolveFlagsResponse } from './generated/confidence/flags/resolver/v1/api';
import { Value } from './Value';

export type CacheEntry = [string, number, Uint8Array];
export type CacheScope = <T>(fn: () => T) => () => T;
export interface CacheOptions {
  ttl?: number;
  scope?: CacheScope;
  entries?: AsyncIterable<CacheEntry>;
}

type CacheValue = { timestamp: number; response: Promise<ResolveFlagsResponse> };
export class FlagCache {
  private constructor(
    private ttl: number,
    private data: AccessiblePromise<Map<string, CacheValue>>,
  ) {}

  get(context: Context, supplier: (context: Context) => Promise<ResolveFlagsResponse>): Promise<ResolveFlagsResponse> {
    return this.data.then(data => {
      const key = Value.serialize(context);
      let entry = data.get(key);
      if (!entry) {
        entry = { timestamp: Date.now(), response: supplier(context) };
        data.set(key, entry);
      }
      return entry.response;
    });
    // this.evict();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<CacheEntry> {
    const data = await this.data;
    for (const [key, { timestamp, response }] of data) {
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

  toOptions(): CacheOptions {
    return {
      ttl: this.ttl,
      entries: this,
    };
  }

  static provider({ scope, ttl = Infinity, entries }: CacheOptions): () => FlagCache {
    const data = AccessiblePromise.resolve(entries ? FlagCache.unmarshalEntries(entries) : new Map());
    if (scope) {
      const provider = () => new FlagCache(ttl, data);
      return scope(provider);
    } else {
      const cache = new FlagCache(ttl, data);
      return () => cache;
    }
  }

  private static async unmarshalEntries(entries: AsyncIterable<CacheEntry>): Promise<Map<string, CacheValue>> {
    const map = new Map<string, CacheValue>();
    for await (const [key, timestamp, data] of entries) {
      map.set(key, { timestamp, response: AccessiblePromise.resolve(ResolveFlagsResponse.decode(data)) });
      // yield [key, { timestamp, response: promise.then(ResolveFlagsResponse.decode) }];
    }
    return map;
  }
}
