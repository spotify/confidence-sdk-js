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

  export type Resolved<T> = (Matched<T> | Unmatched<T> | Failed<T>) & { stale: false };
  export type Stale<T> = (Matched<T> | Unmatched<T> | Failed<T>) & { stale: true } & PromiseLike<Resolved<T>>;
}
export type FlagEvaluation<T> = FlagEvaluation.Resolved<T> | FlagEvaluation.Stale<T>;

export type FlagState = 'NOT_READY' | 'READY' | 'STALE' | 'ERROR';
export type FlagStateObserver = (state: FlagState) => void;
export interface FlagResolver {
  subscribe(...flagNames: string[]): () => void;
  subscribe(...args: [...flagNames: string[], onStateChange: FlagStateObserver]): () => void;

  //private currentResolution?:FlagResolution
  //private pendingResolution?:Promise<FlagResolution>
  // internal?
  // resolveFlags(...flagNames: string[]): Promise<void>;
  /*
    pendingResolution?.abort();
    pendingResolution = client.resolve()
    pendingResolution.then(resolution => {
      currrentResolution = resolution;
      pendingResolution = undefined;
    })
  */

  // internal
  // evaluateFlagSync<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T>;

  evaluateFlag(path: string, defaultValue: number): FlagEvaluation<number>;
  evaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T>;
  /*
    // here we also need to trigger a first resolve if there are no current or pending
    const evaluation = currentResolution ? currentResolution.evaluate(...) : {
      reason: 'ERROR',
      errorCode: 'NOT_READY'
    }
    if(!currentResolution || currentResolution.context !== getContext) { 
      evaluation.stale = true;
      evaluation.then = (onFulfilled, onRejected) => {
        if(!pendingResolution) {
          resolveFlags()
        }
        return pendingResolution.then(onFulfilled, onRejected);
      }
    }
    return evaluation

  */
  getFlag<T extends Value>(path: string, defaultValue: T): Promise<T>;
}
