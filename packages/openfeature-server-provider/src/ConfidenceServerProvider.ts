import {
  ProviderMetadata,
  ProviderStatus,
  EvaluationContext,
  Logger,
  ResolutionDetails,
  JsonValue,
  ErrorCode,
  Provider,
} from '@openfeature/js-sdk';
import equal from 'fast-deep-equal';

import { ConfidenceClient, ResolveContext, ApplyManager, Configuration } from '@spotify-confidence/client-http';

interface ConfidenceServerProviderOptions {
  apply?: {
    timeout?: number;
  };
}

export class ConfidenceServerProvider implements Provider {
  readonly metadata: ProviderMetadata = {
    name: 'ConfidenceServerProvider',
  };
  status: ProviderStatus = ProviderStatus.READY;
  private readonly client: ConfidenceClient;
  private configuration: Configuration | null = null;
  private readonly applyManager: ApplyManager;

  constructor(client: ConfidenceClient, options?: ConfidenceServerProviderOptions) {
    this.client = client;
    this.applyManager = new ApplyManager({ client, timeout: options?.apply?.timeout || 250 });
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

  private getFlag<T>(flagKey: string, defaultValue: T, _logger: Logger): ResolutionDetails<T> {
    if (!this.configuration) {
      return {
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        value: defaultValue,
        reason: 'ERROR',
      };
    }

    const [flagName, ...pathParts] = flagKey.split('.');
    try {
      const flag = this.configuration.flags[`flags/${flagName}`];

      if (!flag) {
        return {
          errorCode: ErrorCode.FLAG_NOT_FOUND,
          value: defaultValue,
          reason: 'ERROR',
        };
      }

      if (flag.reason !== Configuration.ResolveReason.Match) {
        return {
          errorCode: ErrorCode.GENERAL,
          value: defaultValue,
          reason: flag.reason,
        };
      }

      const flagValue = flag.getValue(...pathParts);
      if (flagValue === null) {
        return {
          errorCode: 'PARSE_ERROR' as ErrorCode,
          value: defaultValue,
          reason: 'ERROR',
        };
      }

      if (!flagValue.match(defaultValue)) {
        return {
          errorCode: 'TYPE_MISMATCH' as ErrorCode,
          value: defaultValue,
          reason: 'ERROR',
        };
      }
      if (flagValue.value === null) {
        return {
          value: defaultValue,
          reason: flag.reason,
        };
      }
      this.applyManager.apply(this.configuration.resolveToken, flagName);
      return {
        value: flagValue.value,
        reason: 'TARGETING_MATCH',
        variant: flag.variant,
        flagMetadata: {
          resolveToken: this.configuration.resolveToken || '',
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

    if (!!this.configuration && equal(this.configuration.context, this.convertContext(context))) {
      if (this.configuration.flags[`flags/${flagName}`]) {
        return this.getFlag(flagKey, defaultValue, logger);
      }
    }

    this.configuration = await this.client.resolve(this.convertContext(context || {}), {
      flags: [`flags/${flagName}`],
    });

    return this.getFlag(flagKey, defaultValue, logger);
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
