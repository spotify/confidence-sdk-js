import { Contextual } from '.';
import { Value } from './Value';

export namespace FlagEvaluation {
  export type ErrorCode = 'FLAG_NOT_FOUND' | 'TYPE_MISMATCH' | 'NOT_READY' | 'TIMEOUT' | 'GENERAL';
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
    readonly errorCode: ErrorCode;
    readonly errorMessage: string;
  }

  export type Resolved<T> = Matched<T> | Unmatched<T> | Failed<T>;
  export type Stale<T> = Resolved<T> & PromiseLike<Resolved<T>>;
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type FlagEvaluation<T> = FlagEvaluation.Resolved<T> | FlagEvaluation.Stale<T>;

export type State = 'NOT_READY' | 'READY' | 'STALE' | 'ERROR';
export type StateObserver = (state: State) => void;
export interface FlagResolver extends Contextual<FlagResolver> {
  subscribe(onStateChange?: StateObserver): () => void;

  evaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<Value.Widen<T>>;

  getFlag<T extends Value>(path: string, defaultValue: T): Promise<Value.Widen<T>>;
}
