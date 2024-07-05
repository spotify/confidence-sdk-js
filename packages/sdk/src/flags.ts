import { Contextual } from '.';
import { Value } from './Value';

/**
 * Flag evaluation identifiers
 * @public
 */
export namespace FlagEvaluation {
  /** Error code thrown in case flag couldn't be correctly evaluated */
  export type ErrorCode = 'FLAG_NOT_FOUND' | 'TYPE_MISMATCH' | 'NOT_READY' | 'TIMEOUT' | 'GENERAL';
  /** Flag evaluation case of Matched */
  export interface Matched<T> {
    /** Matched reason */
    readonly reason: 'MATCH';
    /** Flag value */
    readonly value: T;
    /** Flag variant */
    readonly variant: string;
  }

  /** Flag evaluation case of Unmatched */
  export interface Unmatched<T> {
    /** Unmatched reason */
    readonly reason:
      | 'UNSPECIFIED'
      | 'NO_SEGMENT_MATCH'
      | 'NO_TREATMENT_MATCH'
      | 'FLAG_ARCHIVED'
      | 'TARGETING_KEY_ERROR';
    /** Flag value */
    readonly value: T;
  }

  /** Flag evaluation case of Failed */
  export interface Failed<T> {
    /** Failed reason */
    readonly reason: 'ERROR';
    /** Flag value */
    readonly value: T;
    /** Error code */
    readonly errorCode: ErrorCode;
    /** Error message */
    readonly errorMessage: string;
  }

  /** Flag evaluation case of Resolved */
  export type Resolved<T> = Matched<T> | Unmatched<T> | Failed<T>;
  /** Flag evaluation case of Stale */
  export type Stale<T> = Resolved<T> & PromiseLike<Resolved<T>>;
}
/** Flag evaluation */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type FlagEvaluation<T> = FlagEvaluation.Resolved<T> | FlagEvaluation.Stale<T>;

/**
 * Flags states
 * @public
 */
export type State = 'NOT_READY' | 'READY' | 'STALE' | 'ERROR';
/**
 * Flag state observer
 * @public */
export type StateObserver = (state: State) => void;
/**
 * Flag Resolver interface
 * @public
 */
export interface FlagResolver extends Contextual<FlagResolver> {
  /** Subscribe to flag changes in Confidence */
  subscribe(onStateChange?: StateObserver): () => void;

  /** Evaluates a flag */
  evaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<Value.Widen<T>>;

  /** Returns flag value for a given flag */
  getFlag<T extends Value>(path: string, defaultValue: T): Promise<Value.Widen<T>>;

  evictFlagCache(): void;
}
