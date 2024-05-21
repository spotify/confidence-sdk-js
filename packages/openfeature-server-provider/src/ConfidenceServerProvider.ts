import {
  ErrorCode,
  EvaluationContext,
  EvaluationContextValue,
  JsonValue,
  Logger,
  Provider,
  ProviderMetadata,
  ProviderStatus,
  ResolutionDetails,
} from '@openfeature/server-sdk';

import { Context, FlagResolver, Value } from '@spotify-confidence/sdk';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export class ConfidenceServerProvider implements Provider {
  readonly metadata: ProviderMetadata = {
    name: 'ConfidenceServerProvider',
  };
  status: ProviderStatus = ProviderStatus.READY;
  private readonly confidence: FlagResolver;

  constructor(client: FlagResolver) {
    this.confidence = client;
  }

  private async fetchFlag<T extends Value>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<T>> {
    const evaluation = await this.confidence.withContext(convertContext(context)).evaluateFlag(flagKey, defaultValue);

    // const evaluation = flagResolution.evaluate(flagKey, defaultValue);
    if (evaluation.reason === 'ERROR') {
      const { errorCode, ...rest } = evaluation;
      return {
        ...rest,
        errorCode: this.mapErrorCode(errorCode),
      };
    }
    return evaluation;
  }
  private mapErrorCode(errorCode: 'FLAG_NOT_FOUND' | 'TYPE_MISMATCH' | 'NOT_READY' | 'GENERAL'): ErrorCode {
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
  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<boolean>> {
    return this.fetchFlag(flagKey, defaultValue, context, logger);
  }

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<number>> {
    return this.fetchFlag(flagKey, defaultValue, context, logger);
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<T>> {
    Value.assertValue(defaultValue);
    return this.fetchFlag(flagKey, defaultValue, context, logger);
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<string>> {
    return this.fetchFlag(flagKey, defaultValue, context, logger);
  }
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

function convertStruct(value: { [key: string]: EvaluationContextValue }): Value.Struct {
  const struct: Mutable<Value.Struct> = {};
  for (const key of Object.keys(value)) {
    if (typeof value[key] === 'undefined') continue;
    struct[key] = convertValue(value[key]);
  }
  return struct;
}
