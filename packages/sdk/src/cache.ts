import { Context } from './context';
import { AbstractCache } from './dating-cache';
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
  // TODO make Provider take the clientKey
  export type Provider = () => FlagCache;

  export type Scope = (provider: Provider) => Provider;

  let singletonCache: FlagCache | undefined;
  export const singletonScope: Scope = provider => {
    return () => {
      if (!singletonCache) {
        singletonCache = provider();
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

  export function provider({ scope = defaultScope(), entries }: FlagCache.Options): FlagCache.Provider {
    const provider = scope(() => new FlagCache());
    if (entries) {
      provider().load(entries);
    }
    return provider;
  }
}
