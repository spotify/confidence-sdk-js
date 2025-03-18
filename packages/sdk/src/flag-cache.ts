import { Context } from './context';
import { AbstractCache } from './abstract-cache';
import { ResolveFlagsResponse } from './generated/confidence/flags/resolver/v1/api';
import { Value } from './Value';

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

  toOptions(signal?: AbortSignal): FlagCache.Options {
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
  export type Provider = (clientKey: string) => FlagCache;

  export type Scope = (provider: Provider) => Provider;

  const singletonCaches = new Map<string, FlagCache>();
  export const singletonScope: Scope = provider => {
    return clientKey => {
      let singletonCache = singletonCaches.get(clientKey);
      if (!singletonCache) {
        singletonCache = provider(clientKey);
        singletonCaches.set(clientKey, singletonCache);
      }
      return singletonCache;
    };
  };

  export const noScope: Scope = (provider: Provider) => provider;

  function defaultScope(): Scope {
    return typeof window === 'undefined' ? noScope : singletonScope;
  }

  export type Entry = [string, Uint8Array];
  export interface Options {
    scope?: Scope;
    entries?: AsyncIterable<Entry>;
  }

  export function provider(
    clientKey: string,
    { scope = defaultScope(), entries }: FlagCache.Options,
  ): FlagCache.Provider {
    const provider = scope(() => new FlagCache());
    if (entries) {
      provider(clientKey).load(entries);
    }
    return provider;
  }
}
