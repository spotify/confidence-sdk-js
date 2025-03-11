import { Context } from './context';
import { ResolveFlagsResponse } from './generated/confidence/flags/resolver/v1/api';
import { Value } from './Value';

export type CacheEntry = [string, number, Promise<Uint8Array>];
type CacheValue = { timestamp: number; response: Promise<ResolveFlagsResponse> };
export class FlagCache {
  ttl: number;
  data: Map<string, CacheValue>;

  constructor(ttl: number, entries: Iterable<CacheEntry> = []) {
    this.ttl = ttl;
    this.data = new Map(FlagCache.unmarshalEntries(entries));
  }

  get(context: Context, supplier: (context: Context) => Promise<ResolveFlagsResponse>): Promise<ResolveFlagsResponse> {
    this.evict();
    const key = Value.serialize(context);
    let entry = this.data.get(key);
    if (!entry) {
      entry = { timestamp: Date.now(), response: supplier(context) };
      this.data.set(key, entry);
    }
    return entry.response;
  }

  *entries(): Iterable<CacheEntry> {
    this.evict();
    for (const [key, { timestamp, response }] of this.data.entries()) {
      yield [key, timestamp, response.then(value => ResolveFlagsResponse.encode(value).finish())];
    }
  }

  evict() {
    const deadline = Date.now() - this.ttl;
    for (const [key, { timestamp }] of this.data.entries()) {
      if (timestamp > deadline) return;
      this.data.delete(key);
    }
  }

  private static *unmarshalEntries(entries: Iterable<CacheEntry>): Iterable<[string, CacheValue]> {
    for (const [key, timestamp, promise] of entries) {
      yield [key, { timestamp, response: promise.then(ResolveFlagsResponse.decode) }];
    }
  }
}
