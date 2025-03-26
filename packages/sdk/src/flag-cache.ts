import { Context } from './context';
import { AbstractCache } from './abstract-cache';
import { ResolveFlagsResponse } from './generated/confidence/flags/resolver/v1/api';
import { Value } from './Value';

/**
 * A function that creates a new flag cache instance for a given client key.
 * @param clientKey - The unique identifier for the client.
 * @returns A new flag cache instance.
 */
export type CacheProvider = (clientKey: string) => FlagCache;

/**
 * Wraps a CacheProvider in a scope.
 *
 * In a React server environment we recommend to use React.cache.
 *
 * @param provider - The provider function to create a new flag cache instance.
 * @returns A scoped flag cache provider.
 */
export type CacheScope = (provider: CacheProvider) => CacheProvider;

/**
 * A cache entry is a tuple of a string key and a Uint8Array value.
 */
export type CacheEntry = [string, Uint8Array];

/**
 * Options for the flag cache.
 * @public
 */
export interface CacheOptions {
  /**
   * The scope of the flag cache.
   */
  scope?: CacheScope;
  /** @internal */
  entries?: AsyncIterable<CacheEntry>;
}
export class FlagCache extends AbstractCache<Context, ResolveFlagsResponse, Uint8Array> {
  protected serialize(value: ResolveFlagsResponse): Uint8Array {
    return ResolveFlagsResponse.encode(value).finish();
  }
  protected deserialize(value: Uint8Array): ResolveFlagsResponse {
    return ResolveFlagsResponse.decode(value);
  }
  protected serializeKey(key: Context): string {
    return Value.serialize(key);
  }

  protected merge(newValue: ResolveFlagsResponse, oldValue: ResolveFlagsResponse): ResolveFlagsResponse {
    if (newValue.resolveId === oldValue.resolveId) {
      for (let i = 0; i < newValue.resolvedFlags.length; i++) {
        const newFlag = newValue.resolvedFlags[i];
        const oldFlag = oldValue.resolvedFlags[i];
        newFlag.shouldApply = oldFlag.shouldApply;
      }
    }
    return newValue;
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
}

export namespace FlagCache {
  const singletonCaches = new Map<string, FlagCache>();
  export const singletonScope: CacheScope = provider => {
    return clientKey => {
      let singletonCache = singletonCaches.get(clientKey);
      if (!singletonCache) {
        singletonCache = provider(clientKey);
        singletonCaches.set(clientKey, singletonCache);
      }
      return singletonCache;
    };
  };

  export const noScope: CacheScope = (provider: CacheProvider) => provider;

  function defaultScope(): CacheScope {
    return typeof window === 'undefined' ? noScope : singletonScope;
  }

  export function provider(clientKey: string, { scope = defaultScope(), entries }: CacheOptions): CacheProvider {
    const provider = scope(() => new FlagCache());
    if (entries) {
      provider(clientKey).load(entries);
    }
    return provider;
  }
}
