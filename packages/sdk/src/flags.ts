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
    // TODO Change PROVIDER_NOT_READY to NOT_READY
    readonly errorCode: 'FLAG_NOT_FOUND' | 'TYPE_MISMATCH' | 'PROVIDER_NOT_READY' | 'GENERAL';
    readonly errorMessage: string;
  }

  export type Resolved<T> = (Matched<T> | Unmatched<T> | Failed<T>) & { stale?: false };
  export type Stale<T> = (Matched<T> | Unmatched<T> | Failed<T>) & { stale: true } & PromiseLike<Resolved<T>>;
}
export type FlagEvaluation<T> = FlagEvaluation.Resolved<T> | FlagEvaluation.Stale<T>;

export type FlagState = 'NOT_READY' | 'READY' | 'STALE';
export type FlagStateObserver = (state: FlagState) => void;
export interface FlagResolver {
  subscribe(...flagNames: string[]): () => void;
  subscribe(...args: [...flagNames: string[], onStateChange: FlagStateObserver]): () => void;

  evaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T>;
  getFlag<T extends Value>(path: string, defaultValue: T): Promise<T>;
}
