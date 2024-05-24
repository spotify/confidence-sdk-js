import { Schema } from './Schema';
import { Value } from './Value';
import { TypeMismatchError } from './error';
import { FlagEvaluation } from './flags';
import { ResolveFlagsResponse } from './generated/confidence/flags/resolver/v1/api';
import { ResolveReason } from './generated/confidence/flags/resolver/v1/types';

const FLAG_PREFIX = 'flags/';

export interface FlagResolution {
  readonly context: Value.Struct;
  // readonly flagNames:string[]
  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation.Resolved<T>;
}

export namespace FlagResolution {
  export function create(context: Value.Struct, response: ResolveFlagsResponse, applier?: Applier): FlagResolution {
    return new FlagResolutionImpl(context, response, applier);
  }
}

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
};

export type Applier = (flagName: string) => void;

export class FlagResolutionImpl implements FlagResolution {
  private readonly flags: Map<string, ResolvedFlag> = new Map();
  private readonly cachedEvaluations: Map<string, [defaultValue: any, evaluation: FlagEvaluation.Resolved<any>]> =
    new Map();
  readonly resolveToken: string;

  constructor(
    readonly context: Value.Struct,
    resolveResponse: ResolveFlagsResponse,
    private readonly applier?: Applier,
  ) {
    for (const { flag, variant, value, reason, flagSchema } of resolveResponse.resolvedFlags) {
      const name = flag.slice(FLAG_PREFIX.length);

      const schema = flagSchema ? Schema.parse({ structSchema: flagSchema }) : Schema.ANY;
      this.flags.set(name, {
        schema,
        value: value! as Value.Struct,
        variant,
        reason: toEvaluationReason(reason),
      });
    }
    this.resolveToken = base64FromBytes(resolveResponse.resolveToken);
  }

  doEvaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation.Resolved<T> {
    try {
      const [name, ...steps] = path.split('.');
      const flag = this.flags.get(name);
      if (!flag) {
        return {
          reason: 'ERROR',
          value: defaultValue,
          errorCode: 'FLAG_NOT_FOUND',
          errorMessage: `Flag "${name}" not found`,
        };
      }
      const reason = flag.reason;
      if (reason === 'ERROR') throw new Error('Unknown resolve error');
      if (reason !== 'MATCH') {
        if (reason === 'NO_SEGMENT_MATCH' && this.applier) {
          this.applier?.(name);
        }
        return {
          reason,
          value: defaultValue,
        };
      }

      const value = TypeMismatchError.hoist(name, () => Value.get(flag.value, ...steps) as T);

      const schema = flag.schema.get(...steps);
      TypeMismatchError.hoist(['defaultValue', ...steps], () => {
        schema.assertAssignsTo(defaultValue);
      });

      this.applier?.(name);
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
  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation.Resolved<T> {
    let entry = this.cachedEvaluations.get(path);
    if (!entry || !Value.equal(entry[0], defaultValue)) {
      entry = [defaultValue, this.doEvaluate(path, defaultValue)];
      // entry[1].id = Date.now();
      this.cachedEvaluations.set(path, entry);
    }
    return entry[1];
  }

  getValue<T extends Value>(path: string, defaultValue: T): T {
    return this.evaluate(path, defaultValue).value;
  }
}

function toEvaluationReason(reason: ResolveReason): Exclude<FlagEvaluation<unknown>['reason'], 'PENDING'> {
  switch (reason) {
    case ResolveReason.RESOLVE_REASON_UNSPECIFIED:
      return 'UNSPECIFIED';
    case ResolveReason.RESOLVE_REASON_MATCH:
      return 'MATCH';
    case ResolveReason.RESOLVE_REASON_NO_SEGMENT_MATCH:
      return 'NO_SEGMENT_MATCH';
    case ResolveReason.RESOLVE_REASON_NO_TREATMENT_MATCH:
      return 'NO_TREATMENT_MATCH';
    case ResolveReason.RESOLVE_REASON_FLAG_ARCHIVED:
      return 'FLAG_ARCHIVED';
    case ResolveReason.RESOLVE_REASON_TARGETING_KEY_ERROR:
      return 'TARGETING_KEY_ERROR';
    case ResolveReason.RESOLVE_REASON_ERROR:
      return 'ERROR';
    default:
      return 'UNSPECIFIED';
  }
}

function base64FromBytes(arr: Uint8Array): string {
  if ((globalThis as any).Buffer) {
    return globalThis.Buffer.from(arr).toString('base64');
  }
  const bin: string[] = [];
  arr.forEach(byte => {
    bin.push(globalThis.String.fromCharCode(byte));
  });
  return globalThis.btoa(bin.join(''));
}
