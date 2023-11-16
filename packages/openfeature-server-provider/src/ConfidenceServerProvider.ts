import {
  ErrorCode,
  EvaluationContext,
  JsonValue,
  Logger,
  Provider,
  ProviderMetadata,
  ProviderStatus,
  ResolutionDetails,
  ResolutionReason,
} from '@openfeature/js-sdk';

import { ConfidenceClient, ResolveContext, Configuration } from '@spotify-confidence/client-http';

export class ConfidenceServerProvider implements Provider {
  readonly metadata: ProviderMetadata = {
    name: 'ConfidenceServerProvider',
  };
  status: ProviderStatus = ProviderStatus.READY;
  private readonly client: ConfidenceClient;

  constructor(client: ConfidenceClient) {
    this.client = client;
  }

  private convertContext(context: EvaluationContext): ResolveContext {
    const { targetingKey, ...rest } = context;
    if (targetingKey) {
      return {
        ...rest,
        targeting_key: targetingKey,
      };
    }
    return rest;
  }

  private getFlag<T>(
    configuration: Configuration,
    flagKey: string,
    defaultValue: T,
    _logger: Logger,
  ): ResolutionDetails<T> {
    if (!configuration) {
      return {
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        value: defaultValue,
        reason: 'ERROR',
      };
    }

    const [flagName, ...pathParts] = flagKey.split('.');
    try {
      const flag = configuration.flags[flagName];

      if (!flag) {
        return {
          errorCode: ErrorCode.FLAG_NOT_FOUND,
          value: defaultValue,
          reason: 'ERROR',
        };
      }

      if (Configuration.ResolveReason.NoSegmentMatch === flag.reason) {
        return {
          value: defaultValue,
          reason: 'DEFAULT',
        };
      }

      let flagValue: Configuration.FlagValue;
      try {
        flagValue = Configuration.FlagValue.traverse(flag, pathParts.join('.'));
      } catch (e) {
        return {
          errorCode: 'PARSE_ERROR' as ErrorCode,
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
      if (!Configuration.FlagValue.matches(flagValue, defaultValue)) {
        return {
          errorCode: 'TYPE_MISMATCH' as ErrorCode,
          value: defaultValue,
          reason: 'ERROR',
        };
      }

      return {
        value: flagValue.value as T,
        reason: mapConfidenceReason(flag.reason),
        variant: flag.variant,
        flagMetadata: {
          resolveToken: configuration.resolveToken || '',
        },
      };
    } catch (e) {
      return {
        errorCode: ErrorCode.GENERAL,
        value: defaultValue,
        reason: 'ERROR',
      };
    }
  }

  private async fetchFlag<T>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    logger: Logger,
  ): Promise<ResolutionDetails<T>> {
    const [flagName, ..._] = flagKey.split('.');

    const configuration = await this.client.resolve(this.convertContext(context || {}), {
      flags: [`flags/${flagName}`],
    });

    return this.getFlag(configuration, flagKey, defaultValue, logger);
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

function mapConfidenceReason(reason: Configuration.ResolveReason): ResolutionReason {
  switch (reason) {
    case Configuration.ResolveReason.Archived:
      return 'DISABLED';
    case Configuration.ResolveReason.Unspecified:
      return 'UNKNOWN';
    case Configuration.ResolveReason.Match:
      return 'TARGETING_MATCH';
    default:
      return 'DEFAULT';
  }
}
