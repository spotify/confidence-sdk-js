import { Value } from './Value';

/*
Confidence backends reasons:
  // Unspecified enum.
  UNSPECIFIED = 0;
  // The flag was successfully resolved because one rule matched.
  MATCH = 1;
  // The flag could not be resolved because no rule matched.
  NO_SEGMENT_MATCH = 2;
  // The flag could not be resolved because the matching rule had no variant
  // that could be assigned.
  NO_TREATMENT_MATCH = 3 [deprecated = true];
  // The flag could not be resolved because it was archived.
  FLAG_ARCHIVED = 4;
  // The flag could not be resolved because the targeting key field was invalid
  TARGETING_KEY_ERROR = 5;
  // Unknown error occurred during the resolve
  ERROR = 6;



OpenFeature error code (Spec)
    PROVIDER_NOT_READY	The value was resolved before the provider was initialized.
    FLAG_NOT_FOUND	The flag could not be found.
    PARSE_ERROR	An error was encountered parsing data, such as a flag configuration.
    TYPE_MISMATCH	The type of the flag value does not match the expected type.
    TARGETING_KEY_MISSING	The provider requires a targeting key and one was not provided in the evaluation context.
    INVALID_CONTEXT	The evaluation context does not meet provider requirements.
    PROVIDER_FATAL	The provider has entered an irrecoverable error state.
    GENERAL	The error was for a reason not enumerated above.

OpenFeature reason (Spec)
    STATIC	The resolved value is static (no dynamic evaluation).
    DEFAULT	The resolved value fell back to a pre-configured value (no dynamic evaluation occurred or dynamic evaluation yielded no result).
    TARGETING_MATCH	The resolved value was the result of a dynamic evaluation, such as a rule or specific user-targeting.
    SPLIT	The resolved value was the result of pseudorandom assignment.
    CACHED	The resolved value was retrieved from cache.
    DISABLED	The resolved value was the result of the flag being disabled in the management system.
    UNKNOWN	The reason for the resolved value could not be determined.
    STALE	The resolved value is non-authoritative or possibly out of date
    ERROR	The resolved value was the result of an error.
*/

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

export interface FlagResolution {
  readonly context: Value.Struct;
  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T>;
  getValue<T extends Value>(path: string, defaultValue: T): T;
}

export interface FlagResolver {
  resolveFlags(...names: string[]): Promise<FlagResolution>;
  evaluateFlag<T extends Value>(path: string, defaultValue: T): Promise<FlagEvaluation<T>>;
  getFlag<T extends Value>(path: string, defaultValue: T): Promise<T>;
}
