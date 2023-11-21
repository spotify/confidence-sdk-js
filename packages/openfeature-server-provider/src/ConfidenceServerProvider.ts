import {
  ErrorCode,
  EvaluationContext,
  FlagNotFoundError,
  JsonValue,
  Logger,
  ParseError,
  Provider,
  ProviderMetadata,
  ProviderStatus,
  ResolutionDetails,
  ResolutionReason,
  TypeMismatchError,
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
    logger: Logger,
  ): ResolutionDetails<T> {
    if (!configuration) {
      return {
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        value: defaultValue,
        reason: 'ERROR',
      };
    }

    const [flagName, ...pathParts] = flagKey.split('.');

    const flag = configuration.flags[flagName];

    if (!flag) {
      logger.warn('Flag "%s" was not found', flagName);
      throw new FlagNotFoundError(`Flag "${flagName}" was not found`);
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
      logger.warn('Value with path "%s" was not found in flag "%s"', pathParts.join('.'), flagName);
      throw new ParseError();
    }

    if (!Configuration.FlagValue.matches(flagValue, defaultValue)) {
      logger.warn('Value for "%s" is of incorrect type', flagKey);
      throw new TypeMismatchError();
    }

    logger.info('Value for "%s" successfully evaluated', flagKey);
    return {
      value: flagValue.value === null ? defaultValue : (flagValue.value as T),
      reason: mapConfidenceReason(flag.reason),
      variant: flag.variant,
      flagMetadata: {
        resolveToken: configuration.resolveToken || '',
      },
    };
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
