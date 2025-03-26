import { Schema } from './Schema';
import { Value } from './Value';
import { TypeMismatchError } from './error';
import { FlagEvaluation } from './flags';
import { ResolveFlagsResponse } from './generated/confidence/flags/resolver/v1/api';
import { ResolveReason } from './generated/confidence/flags/resolver/v1/types';

const FLAG_PREFIX = 'flags/';

export interface FlagResolution {
  readonly state: 'READY' | 'ERROR';
  readonly context: Value.Struct;
  // readonly flagNames:string[]
  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation.Resolved<T>;
}

export namespace FlagResolution {
  export function ready(context: Value.Struct, response: ResolveFlagsResponse, applier?: Applier): FlagResolution {
    return new ReadyFlagResolution(context, response, applier);
  }

  export function failed(context: Value.Struct, code: FlagEvaluation.ErrorCode, message: string): FlagResolution {
    return new FailedFlagResolution(context, code, message);
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
  shouldApply: boolean;
};

export type Applier = (flagName: string) => void;

export class ReadyFlagResolution implements FlagResolution {
  private readonly flags: Map<string, ResolvedFlag> = new Map();
  readonly resolveToken: string;
  declare state: 'READY';

  constructor(
    readonly context: Value.Struct,
    resolveResponse: ResolveFlagsResponse,
    private readonly applier?: Applier,
  ) {
    for (const resolvedFlag of resolveResponse.resolvedFlags) {
      const { flag, variant, value, reason, flagSchema } = resolvedFlag;
      const name = flag.slice(FLAG_PREFIX.length);

      const schema = flagSchema ? Schema.parse({ structSchema: flagSchema }) : Schema.ANY;
      this.flags.set(name, {
        schema,
        value: value! as Value.Struct,
        variant,
        reason: toEvaluationReason(reason),
        set shouldApply(value) {
          resolvedFlag.shouldApply = value;
        },
        get shouldApply() {
          return resolvedFlag.shouldApply;
        },
      });
    }
    this.resolveToken = base64FromBytes(resolveResponse.resolveToken);
  }

  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation.Resolved<T> {
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

      if (flag.shouldApply && this.applier) {
        this.applier?.(name);
        flag.shouldApply = false;
      }

      if (reason !== 'MATCH') {
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
}

ReadyFlagResolution.prototype.state = 'READY';

export class FailedFlagResolution implements FlagResolution {
  declare state: 'ERROR';
  constructor(readonly context: Value.Struct, readonly code: FlagEvaluation.ErrorCode, readonly message: string) {}

  evaluate<T extends Value>(_path: string, defaultValue: T): FlagEvaluation.Resolved<T> {
    return {
      reason: 'ERROR',
      value: defaultValue,
      errorCode: this.code,
      errorMessage: this.message,
    };
  }
}
FailedFlagResolution.prototype.state = 'ERROR';

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
