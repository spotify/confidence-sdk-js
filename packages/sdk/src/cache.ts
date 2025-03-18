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

interface CacheNode {
  key: string;
  value: CacheValue;
  next: Promise<CacheNode>;
}
type CacheValue = { timestamp: number; response: Promise<ResolveFlagsResponse> };
export class FlagCache {
  private readonly data: Map<string, CacheValue> = new Map();
  private resolveNext!: (value: CacheNode | PromiseLike<CacheNode>) => void;
  private head: Promise<CacheNode>;
  private tail: Promise<CacheNode>;

  private constructor(private ttl: number, entries: Iterable<CacheEntry> = []) {
    this.head = this.tail = new Promise<CacheNode>(resolve => {
      this.resolveNext = resolve;
    });
    for (const [key, _timestamp, data] of entries) {
      this.put(key, AccessiblePromise.resolve(ResolveFlagsResponse.decode(data)));
    }
  }

  get(context: Context, supplier: (context: Context) => Promise<ResolveFlagsResponse>): Promise<ResolveFlagsResponse> {
    const key = Value.serialize(context);
    const value = this.data.get(key);
    if (!value) {
      const response = supplier(context);
      this.put(key, response);
      return response;
    }
    return value.response;
  }

  put(context: Context | string, response: Promise<ResolveFlagsResponse>): void {
    const key = typeof context === 'string' ? context : Value.serialize(context);
    const timestamp = Date.now();
    const resolveCurrent = this.resolveNext;
    const next = new Promise<CacheNode>(resolve => {
      this.resolveNext = resolve;
    });
    const value = { timestamp, response };
    resolveCurrent({ key, value, next });
    this.data.set(key, value);
  }

  private async *entries(closed: boolean): AsyncIterableIterator<CacheEntry> {
    let next = this.head;
    while (!closed || next !== this.tail) {
      const node = await next;
      const { timestamp, response } = node.value;
      yield [node.key, timestamp, ResolveFlagsResponse.encode(await response).finish()];
      next = node.next;
    }
  }

  toOptions(signal?: AbortSignal): Promise<CacheOptions> {
    const it = this.entries(!signal);
    if (signal) {
      if (signal.aborted) {
        it.return!();
      } else {
        signal.addEventListener('abort', () => {
          it.return!();
        });
      }
    }
    return arrayFromAsync(it).then(entries => {
      return { ttl: this.ttl, entries };
    });
  }

  static provider({ scope = defaultScope(), ttl = Infinity, entries }: CacheOptions): CacheProvider {
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
