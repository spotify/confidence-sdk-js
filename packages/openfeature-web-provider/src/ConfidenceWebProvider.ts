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
    try {
      if (context) this.confidence.setContext({ openFeature: this.convertContext(context || {}) });
      this.flagResolution = await this.confidence.resolve([]);
      this.status = ProviderStatus.READY;
      return Promise.resolve();
    } catch (e) {
      this.status = ProviderStatus.ERROR;
      throw e;
    }
  }

  async onContextChange(oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void> {
    if (equal(oldContext, newContext)) {
      return;
    }
    this.events.emit(ProviderEvents.Stale);
    try {
      this.confidence.setContext({ openFeature: this.convertContext(newContext) });
      this.flagResolution = await this.confidence.resolve([]);
      this.status = ProviderStatus.READY;
      this.events.emit(ProviderEvents.Ready);
    } catch (e) {
      this.status = ProviderStatus.ERROR;
      this.events.emit(ProviderEvents.Error);
    }
  }

  private convertContext({ targetingKey, ...rest }: EvaluationContext): Context['openFeature'] {
    return { targeting_key: targetingKey, ...(convert(rest) as Value.Struct) };

    function convert(value: EvaluationContextValue): Value {
      if (value === null) return undefined;
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          return value.map(convert);
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        const struct: Record<string, Value> = {};
        for (const key of Object.keys(value)) {
          struct[key] = convert(value[key]);
        }
        return struct;
      }
      return value;
    }
  }

  private getFlag<T>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<T> {
    if (!this.flagResolution) {
      logger.warn('Provider not ready');
      return {
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        value: defaultValue,
        reason: 'ERROR',
      };
    }
    const currContext: any = this.convertContext(context);
    const cachedContext: any = this.flagResolution.context;
    if (Object.keys(currContext).some(key => !equal(currContext[key], cachedContext[key]))) {
      return {
        value: defaultValue,
        reason: 'STALE',
      };
    }

    const [flagName, ...pathParts] = flagKey.split('.');

    try {
      const flag = this.flagResolution.flags[flagName];

      if (!flag) {
        logger.warn('Flag "%s" was not found', flagName);
        return {
          errorCode: ErrorCode.FLAG_NOT_FOUND,
          value: defaultValue,
          reason: 'ERROR',
        };
      }

      if (FlagResolution.ResolveReason.NoSegmentMatch === flag.reason) {
        if (this.confidence.environment === 'client') {
          this.confidence.apply(this.flagResolution.resolveToken, flagName);
        }
        return {
          value: defaultValue,
          reason: 'DEFAULT',
        };
      }

      let flagValue: FlagResolution.FlagValue;
      try {
        flagValue = FlagResolution.FlagValue.traverse(flag, pathParts.join('.'));
      } catch (e) {
        logger.warn('Value with path "%s" was not found in flag "%s"', pathParts.join('.'), flagName);
        return {
          errorCode: ErrorCode.PARSE_ERROR,
          value: defaultValue,
          reason: 'ERROR',
        };
      }

      if (flagValue.value === null) {
        return {
          value: defaultValue,
          reason: mapConfidenceReason(flag.reason),
        };
      }

      if (!FlagResolution.FlagValue.matches(flagValue, defaultValue)) {
        logger.warn('Value for "%s" is of incorrect type', flagKey);
        return {
          errorCode: ErrorCode.TYPE_MISMATCH,
          value: defaultValue,
          reason: 'ERROR',
        };
      }

      if (this.confidence.environment === 'client') {
        this.confidence.apply(this.flagResolution.resolveToken, flagName);
      }
      logger.info('Value for "%s" successfully evaluated', flagKey);
      return {
        value: flagValue.value as T,
        reason: mapConfidenceReason(flag.reason),
        variant: flag.variant,
        flagMetadata: {
          resolveToken: this.flagResolution.resolveToken,
        },
      };
    } catch (e: unknown) {
      logger.warn('Error %o occurred in flag evaluation', e);
      return {
        errorCode: ErrorCode.GENERAL,
        value: defaultValue,
        reason: 'ERROR',
      };
    }
  }

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<boolean> {
    return this.getFlag(flagKey, defaultValue, context, logger);
  }

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<number> {
    return this.getFlag(flagKey, defaultValue, context, logger);
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<T> {
    return this.getFlag(flagKey, defaultValue, context, logger);
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<string> {
    return this.getFlag(flagKey, defaultValue, context, logger);
  }
}

function mapConfidenceReason(reason: FlagResolution.ResolveReason): ResolutionReason {
  switch (reason) {
    case FlagResolution.ResolveReason.Archived:
      return 'DISABLED';
    case FlagResolution.ResolveReason.Unspecified:
      return 'UNKNOWN';
    case FlagResolution.ResolveReason.Match:
      return 'TARGETING_MATCH';
    default:
      return 'DEFAULT';
  }
}
