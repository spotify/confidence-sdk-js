import {
  ErrorCode,
  EvaluationContext,
  EvaluationContextValue,
  JsonValue,
  Logger,
  OpenFeatureEventEmitter,
  Provider,
  ProviderEvents,
  ProviderMetadata,
  ProviderStatus,
  ResolutionDetails,
  ResolutionReason,
} from '@openfeature/web-sdk';
import equal from 'fast-deep-equal';

import { Confidence, FlagResolution, Value, Context } from '@spotify-confidence/sdk';

export class ConfidenceWebProvider implements Provider {
  readonly metadata: ProviderMetadata = {
    name: 'ConfidenceWebProvider',
  };
  status: ProviderStatus = ProviderStatus.NOT_READY;
  flagResolution: FlagResolution | null = null;
  readonly events = new OpenFeatureEventEmitter();

  private readonly confidence: Confidence;

  constructor(confidence: Confidence) {
    this.confidence = confidence;
  }

  async initialize(context?: EvaluationContext): Promise<void> {
    Value.assertValue(context);
    Value.assertType('Struct', context);
    if (context) this.confidence.setContext(context);
    this.flagResolution = await this.confidence.resolve([]);
    this.status = ProviderStatus.READY;
    return Promise.resolve();
  }

  async onContextChange(oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void> {
    if (equal(oldContext, newContext)) {
      return;
    }
    this.flagResolution = null;
    this.events.emit(ProviderEvents.Stale);
    Value.assertValue(newContext);
    Value.assertType('Struct', newContext);
    this.confidence.setContext(newContext);
    this.flagResolution = await this.confidence.resolve([]);
    this.status = ProviderStatus.READY;
    this.events.emit(ProviderEvents.Ready);
  }

  // private convertContext({ targetingKey, ...rest }: EvaluationContext): Context['openFeature'] {
  //   return { targeting_key: targetingKey, ...(convert(rest) as Value.Struct) };

  //   function convert(value: EvaluationContextValue): Value {
  //     if (value === null) return undefined;
  //     if (typeof value === 'object') {
  //       if (Array.isArray(value)) {
  //         return value.map(convert);
  //       }
  //       if (value instanceof Date) {
  //         return value.toISOString();
  //       }
  //       const struct: Record<string, Value> = {};
  //       for (const key of Object.keys(value)) {
  //         struct[key] = convert(value[key]);
  //       }
  //       return struct;
  //     }
  //     return value;
  //   }
  // }

  private evaluateFlag<T extends Value>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<T> {
    Value.assertValue(context);
    if (!this.flagResolution || !Value.equal(context, this.flagResolution.context)) {
      logger.warn('Provider not ready');
      return {
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        value: defaultValue,
        reason: 'ERROR',
      };
    }
    const evaluation = this.flagResolution.evaluate(flagKey, defaultValue);
    if (evaluation.reason === 'ERROR') {
      const { errorCode, ...rest } = evaluation;
      return {
        ...rest,
        errorCode: ErrorCode[errorCode],
      };
    }
    return evaluation;
  }

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<boolean> {
    return this.evaluateFlag(flagKey, defaultValue, context, logger);
  }

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<number> {
    return this.evaluateFlag(flagKey, defaultValue, context, logger);
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<T> {
    // this might throw but will be caught by OpenFeature
    Value.assertValue(defaultValue);
    return this.evaluateFlag(flagKey, defaultValue, context, logger);
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<string> {
    return this.evaluateFlag(flagKey, defaultValue, context, logger);
  }
}

// function mapValues<T,S>(object:Record<string, T>, fn:(value:T, key:string) => S):Record<string,S> {
//   const mapped:Record<string, S> = {};
//   for(const key of Object.keys(object)) {
//     mapped[key] = fn(object[key], key);
//   }
//   return mapped;
// }
