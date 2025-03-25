import { Context } from './context';
import { Cache } from './dating-cache';
import { ResolveFlagsResponse } from './generated/confidence/flags/resolver/v1/api';
import { Value } from './Value';

export type CacheEntry = [string, Uint8Array];
export type CacheScope = (provider: CacheProvider) => CacheProvider;
// TODO make CacheProvider take the clientKey
export type CacheProvider = () => FlagCache;
export interface CacheOptions {
  scope?: CacheScope;
  entries?: AsyncIterable<CacheEntry>;
}
export class FlagCache extends Cache<Context, ResolveFlagsResponse, Uint8Array> {
  protected serialize(value: ResolveFlagsResponse): Uint8Array {
    return ResolveFlagsResponse.encode(value).finish();
  }
  protected deserialize(value: Uint8Array): ResolveFlagsResponse {
    return ResolveFlagsResponse.decode(value);
  }
  protected serializeKey(key: Context): string {
    return Value.serialize(key);
  }

  toOptions(signal?: AbortSignal): CacheOptions {
    if (signal && !signal.aborted) {
      this.ref();
      signal.addEventListener('abort', () => {
        this.unref();
      });
    }
    return { entries: this };
  }

  static provider({ scope = defaultScope(), entries }: CacheOptions): CacheProvider {
    const provider = () => new FlagCache(entries);
    return scope(provider);
  }
}

let singletonCache: FlagCache | undefined;
export const singletonScope: CacheScope = provider => {
  return () => {
    if (!singletonCache) {
      singletonCache = provider();
    }
    return singletonCache;
  };
};

export const noScope = (provider: CacheProvider) => provider;

function defaultScope(): CacheScope {
  return typeof window === 'undefined' ? noScope : singletonScope;
}
