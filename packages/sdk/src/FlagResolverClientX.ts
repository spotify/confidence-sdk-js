import { Value } from './Value';
import { Context } from './context';
import { FlagEvaluation, FlagResolution } from './flags';

type ResolveRequest = {
  clientSecret: string;
  evaluationContext: Value.Struct;
  apply?: boolean;
  flags?: string[];
  // sdk: SDK;
};
type ResolveResponse = {
  resolvedFlags: ResolvedFlag[];
  resolveToken: string;
};
type ResolvedFlag = {
  flag: string;
  variant: string;
  value: Value;
  reason:
    | 'RESOLVE_REASON_UNSPECIFIED'
    | 'RESOLVE_REASON_MATCH'
    | 'RESOLVE_REASON_NO_SEGMENT_MATCH'
    | 'RESOLVE_REASON_NO_TREATMENT_MATCH'
    | 'RESOLVE_REASON_FLAG_ARCHIVED';
};

class FlagResolutionImpl implements FlagResolution {
  private readonly flags: Record<string, ResolvedFlag | undefined>;

  constructor(flags: ResolveResponse) {}

  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
    const [name, ...steps] = path.split('.');
    const flag = this.flags[name];
    if (!flag) {
      return {
        reason: 'ERROR',
        value: defaultValue,
        errorCode: 'FLAG_NOT_FOUND',
        errorMessage: `Flag "${name}" not found`,
      };
    }
    let value = flag.value;
    const errorPath: string[] = [];
    for (const step of steps) {
      if (!Value.isStruct(value)) {
        return {
          reason: 'ERROR',
          value: defaultValue,
          errorCode: 'TYPE_MISMATCH',
          errorMessage: `Expected Struct at path "${errorPath.join('.')}" in flag "${name}"`,
        };
      }
    }
    if (!Value.isAssignable(value, defaultValue)) {
      return {
        reason: 'ERROR',
        value: defaultValue,
        errorCode: 'TYPE_MISMATCH',
      };
    }
    throw new Error('Method not implemented.');
  }
  getValue<T extends Value>(path: string, defaultValue: T): T {
    return this.evaluate(path, defaultValue).value;
  }
}
export class FlagResolverClient {
  // private readonly fetch: typeof fetch;

  resolve(_context: Context, _flagNames: string[]): Promise<FlagResolution> {
    throw new Error('Not implemented');
  }
}
