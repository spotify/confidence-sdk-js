import { Value } from './Value';

export namespace FlagEvaluation {
  export interface Matched<T> {
    readonly reason: 'MATCH';
    readonly value: T;
    readonly variant: string;
  }

  export interface Unmatched<T> {
    readonly reason:
      | 'UNSPECIFIED'
      | 'NO_SEGMENT_MATCH'
      | 'NO_TREATMENT_MATCH'
      | 'FLAG_ARCHIVED'
      | 'TARGETING_KEY_ERROR';
    readonly value: T;
  }

  export interface Failed<T> {
    readonly reason: 'ERROR';
    readonly value: T;
    readonly errorCode: 'FLAG_NOT_FOUND' | 'TYPE_MISMATCH' | 'GENERAL';
    readonly errorMessage: string;
  }
}
export type FlagEvaluation<T> = FlagEvaluation.Matched<T> | FlagEvaluation.Unmatched<T> | FlagEvaluation.Failed<T>;
export interface PendingEvaluation<T> extends PromiseLike<FlagEvaluation<T>> {
  readonly reason: 'PENDING';
  readonly value: never;
  readonly errorCode: never;
  readonly errorMessage: never;
}

export interface FlagResolution {
  readonly context: Value.Struct;
  readonly resolveToken: string;
  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T>;
}
export interface PendingFlagResolution extends PromiseLike<FlagResolution> {
  readonly resolved?: FlagResolution;
  readonly context: Value.Struct;
  abort(reason?: any): void;
  evaluate<T extends Value>(path: string, defaultValue: T): never;
}

export interface FlagResolver {
  resolveFlags(...names: string[]): Promise<FlagResolution>;
  evaluateFlag<T extends Value>(path: string, defaultValue: T): Promise<FlagEvaluation<T>>;
  getFlag<T extends Value>(path: string, defaultValue: T): Promise<T>;
}
