import { Schema, TypeMismatchError, Value } from './Value';
import { Context } from './context';
import { FlagEvaluation, FlagResolution } from './flags';

// type ResolveRequest = {
//   clientSecret: string;
//   evaluationContext: Value.Struct;
//   apply?: boolean;
//   flags?: string[];
//   // sdk: SDK;
// };
type ResolveResponse = {
  resolvedFlags: ResolvedFlag[];
  resolveToken: string;
};
type ResolvedFlag = {
  flag: string;
  variant: string;
  value: Value.Struct;
  schema: Schema;
  reason:
    | 'RESOLVE_REASON_UNSPECIFIED'
    | 'RESOLVE_REASON_MATCH'
    | 'RESOLVE_REASON_NO_SEGMENT_MATCH'
    | 'RESOLVE_REASON_NO_TREATMENT_MATCH'
    | 'RESOLVE_REASON_FLAG_ARCHIVED';
};

export class FlagResolutionImpl implements FlagResolution {
  private readonly flags: Record<string, ResolvedFlag | undefined> = {};

  constructor(resolveResponse: ResolveResponse, readonly context: Value.Struct) {
    for (const resolvedFlag of resolveResponse.resolvedFlags) {
      this.flags[resolvedFlag.flag] = resolvedFlag;
    }
  }

  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
    try {
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
      const value = Value.get(flag.value, ...steps) as T;
      const schema = flag.schema.get(...steps);

      schema.assertAssignsTo(defaultValue);

      const reason = toEvaluationReason(flag.reason);
      if (reason !== 'MATCH') {
        return {
          reason,
          value: defaultValue,
        };
      }
      return {
        reason,
        value,
        variant: flag.variant,
      };
    } catch (e: any) {
      return {
        reason: 'ERROR',
        value: defaultValue,
        errorCode: e instanceof TypeMismatchError ? 'TYPE_MISMATCH' : 'GENERAL',
        errorMessage: e.message ?? 'Unknown error',
      };
    }
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

type ReasonSuffix<R> = R extends `RESOLVE_REASON_${infer S}` ? S : never;

function toEvaluationReason<R extends ResolvedFlag['reason']>(reason: R): ReasonSuffix<R> {
  return reason.slice('RESOLVE_REASON_'.length) as ReasonSuffix<R>;
}
