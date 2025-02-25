import { AccessiblePromise } from '../AccessiblePromise';
import { addExtension, ConfigFactory } from '../core';
import { FlagResolution } from '../FlagResolution';
import { Schema } from '../Schema';
import { Value } from '../Value';

addExtension({ id: 'caching', middleware: cachingMiddleware });

type ResolvedFlag = {
  schema: Schema;
  value: Value.Struct;
  variant: string;
  reason:
    | 'UNSPECIFIED'
    | 'MATCH'
    | 'NO_SEGMENT_MATCH'
    | 'NO_TREATMENT_MATCH'
    | 'FLAG_ARCHIVED'
    | 'TARGETING_KEY_ERROR'
    | 'ERROR';
  resolveToken?: string;
};
type Entry = [context: string, ...flags: [name: string, flag: ResolvedFlag][]];
class FlagCache {
  private readonly flags: Map<string, Map<string, ResolvedFlag>> = new Map();

  constructor(entries?: Iterable<Entry>) {
    if (entries) {
      for (const [context, ...flags] of entries) {
        this.flags.set(context, new Map(flags));
      }
    }
  }

  getFlag(context: Value.Struct, name: string): ResolvedFlag | undefined {
    const key = Value.serialize(context);
    return this.flags.get(key)?.get(name);
  }

  setFlag(context: Value.Struct, name: string, flag: ResolvedFlag): void {
    const key = Value.serialize(context);
    if (!this.flags.has(key)) {
      this.flags.set(key, new Map());
    }
    this.flags.get(key)!.set(name, flag);
  }

  *entries(): IterableIterator<Entry> {
    for (const [context, flags] of this.flags) {
      yield [context, ...flags.entries()];
    }
  }
}

function cachingMiddleware(next: ConfigFactory): ConfigFactory {
  return options => {
    const cache = new Map<string, FlagResolution>();
    const { resolveFlags, ...config } = next(options);
    if (!resolveFlags) {
      console.warn('No resolveFlags function provided');
      return config;
    }
    return {
      ...config,
      resolveFlags: ctx => {
        const key = JSON.stringify(ctx);
        if (cache.has(key)) {
          return AccessiblePromise.resolve(cache.get(key)!);
        }
        return resolveFlags(ctx).then(resolution => {
          cache.set(key, resolution);
          return resolution;
        });
      },
    };
  };
}
