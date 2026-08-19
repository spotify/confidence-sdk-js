import {
  ErrorCode,
  EvaluationContext,
  EvaluationContextValue,
  JsonValue,
  Provider,
  ProviderMetadata,
  ProviderStatus,
  ResolutionDetails,
} from '@openfeature/server-sdk';

import { Context, EventData, EventSender, FlagEvaluation, FlagResolver, Value } from '@spotify-confidence/sdk';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * OpenFeature Provider for Confidence Server SDK
 * @public
 */
export class ConfidenceServerProvider implements Provider {
  /** Static data about the provider */
  readonly metadata: ProviderMetadata = {
    name: 'ConfidenceServerProvider',
  };
  /** Current status of the provider. Can be READY, NOT_READY, ERROR, STALE and FATAL. */
  status: ProviderStatus = ProviderStatus.READY;
  private readonly confidence: FlagResolver;

  constructor(client: FlagResolver) {
    this.confidence = client;
  }

  private async fetchFlag<T extends Value>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<T>> {
    const evaluation = (await this.confidence
      .withContext(convertContext(context))
      .evaluateFlag(flagKey, defaultValue)) as FlagEvaluation.Resolved<T>;

    if (evaluation.reason === 'ERROR') {
      const { errorCode, ...rest } = evaluation;
      return {
        ...rest,
        errorCode: this.mapErrorCode(errorCode),
      };
    }
    return evaluation;
  }
  private mapErrorCode(errorCode: FlagEvaluation.ErrorCode): ErrorCode {
    switch (errorCode) {
      case 'FLAG_NOT_FOUND':
        return ErrorCode.FLAG_NOT_FOUND;
      case 'TYPE_MISMATCH':
        return ErrorCode.TYPE_MISMATCH;
      case 'NOT_READY':
        return ErrorCode.PROVIDER_NOT_READY;
      default:
        return ErrorCode.GENERAL;
    }
  }
  /** Resolves with an evaluation of a Boolean flag */
  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<boolean>> {
    return this.fetchFlag(flagKey, defaultValue, context);
  }
  /** Resolves with an evaluation of a Numbers flag */
  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<number>> {
    return this.fetchFlag(flagKey, defaultValue, context);
  }
  /** Resolves with an evaluation of an Object flag */
  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<T>> {
    Value.assertValue(defaultValue);
    return this.fetchFlag(flagKey, defaultValue, context);
  }
  /** Resolves with an evaluation of a String flag */
  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<string>> {
    return this.fetchFlag(flagKey, defaultValue, context);
  }

  /** Tracks an event */
  track(
    trackingEventName: string,
    context: EvaluationContext = {},
    trackingEventDetails: { [key: string]: EvaluationContextValue } & { context?: never } = {},
  ): void {
    const scopedConfidence = this.confidence.withContext(convertContext(context));
    // The public constructor still accepts custom FlagResolvers created before tracking support was added.
    if (!isEventSender(scopedConfidence)) {
      throw new TypeError(
        'The configured FlagResolver does not support event tracking; construct the provider with a Confidence instance',
      );
    }
    // Dynamic event details can bypass the public type; do not let them replace the evaluation context.
    scopedConfidence.track(trackingEventName, convertStruct(trackingEventDetails, 'context') as EventData);
  }

  async onClose(): Promise<void> {
    this.confidence.close?.();
  }
}

function isEventSender(confidence: FlagResolver): confidence is FlagResolver & EventSender {
  return 'track' in confidence && typeof confidence.track === 'function';
}

function convertContext({ targetingKey, ...context }: EvaluationContext): Context {
  const targetingContext = typeof targetingKey !== 'undefined' ? { targeting_key: targetingKey } : {};
  return { ...targetingContext, ...convertStruct(context) };
}

function convertValue(value: EvaluationContextValue): Value {
  if (typeof value === 'object') {
    if (value === null) return undefined;
    if (value instanceof Date) return value.toISOString();
    // @ts-expect-error TODO fix single type array conversion
    if (Array.isArray(value)) return value.map(convertValue);
    return convertStruct(value);
  }
  return value;
}

function convertStruct(value: { [key: string]: EvaluationContextValue }, ignoredKey?: string): Value.Struct {
  const struct: Mutable<Value.Struct> = {};
  for (const key of Object.keys(value)) {
    if (key === ignoredKey || typeof value[key] === 'undefined') continue;
    struct[key] = convertValue(value[key]);
  }
  return struct;
}
