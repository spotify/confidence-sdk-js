import {
  ErrorCode,
  EvaluationContext,
  JsonValue,
  Logger,
  OpenFeatureEventEmitter,
  Provider,
  ProviderEvents,
  ProviderMetadata,
  ProviderStatus,
  ResolutionDetails,
} from '@openfeature/web-sdk';
import equal from 'fast-deep-equal';

import { ApplyManager, ConfidenceClient, Configuration, ResolveContext } from '@spotify-confidence/client-http';

export interface ConfidenceWebProviderOptions {
  initConfiguration?: Configuration.Serialized;
  apply?: {
    timeout?: number;
  };
}

export class ConfidenceWebProvider implements Provider {
  readonly metadata: ProviderMetadata = {
    name: 'ConfidenceWebProvider',
  };
  status: ProviderStatus = ProviderStatus.NOT_READY;
  configuration: Configuration | null = null;
  readonly events = new OpenFeatureEventEmitter();

  private readonly client: ConfidenceClient;
  private readonly applyManager: ApplyManager;
  private isInitialConfiguration: boolean;

  constructor(client: ConfidenceClient, options?: ConfidenceWebProviderOptions) {
    this.client = client;
    this.applyManager = new ApplyManager({ client: this.client, timeout: options?.apply?.timeout || 250 });

    if (options?.initConfiguration) {
      this.configuration = Configuration.toConfiguration(options.initConfiguration);
      this.isInitialConfiguration = true;
    } else {
      this.isInitialConfiguration = false;
    }
  }

  async initialize(context?: EvaluationContext): Promise<void> {
    if (this.isInitialConfiguration) {
      this.isInitialConfiguration = false;
      this.status = ProviderStatus.READY;
      // this event should be emitted by the OpenFeature sdk onto the client handlers, but in current version is not work.
      this.events.emit(ProviderEvents.Ready);
      return Promise.resolve();
    }

    if (this.status === ProviderStatus.READY || this.isInitialConfiguration) {
      this.isInitialConfiguration = false;
      return Promise.resolve();
    }

    try {
      this.configuration = await this.client.resolve(this.convertContext(context || {}), {
        flags: [],
      });
      this.status = ProviderStatus.READY;
      // this event should be emitted by the OpenFeature sdk onto the client handlers, but in current version is not work.
      this.events.emit(ProviderEvents.Ready);
      return Promise.resolve();
    } catch (e) {
      this.status = ProviderStatus.ERROR;
      // this event should be emitted by the OpenFeature sdk onto the client handlers, but in current version is not work.
      this.events.emit(ProviderEvents.Error);
      throw e;
    }
  }

  async onContextChange(oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void> {
    if (equal(oldContext, newContext)) {
      return;
    }
    this.events.emit(ProviderEvents.Stale);
    try {
      this.configuration = await this.client.resolve(this.convertContext(newContext || {}), {
        apply: false,
        flags: [],
      });
      this.status = ProviderStatus.READY;
      this.events.emit(ProviderEvents.Ready);
    } catch (e) {
      this.status = ProviderStatus.ERROR;
      this.events.emit(ProviderEvents.Error);
    }
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
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    logger: Logger,
  ): ResolutionDetails<T> {
    if (!this.configuration) {
      logger.warn('Provider not ready');
      return {
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        value: defaultValue,
        reason: 'ERROR',
      };
    }

    if (!equal(this.configuration.context, this.convertContext(context))) {
      return {
        value: defaultValue,
        reason: 'STALE',
      };
    }

    const [flagName, ...pathParts] = flagKey.split('.');
    try {
      const flag = this.configuration.flags[`flags/${flagName}`];

      if (!flag) {
        logger.warn('Flag "%s" was not found', flagName);
        return {
          errorCode: ErrorCode.FLAG_NOT_FOUND,
          value: defaultValue,
          reason: 'ERROR',
        };
      }

      if (flag.reason !== Configuration.ResolveReason.Match) {
        logger.info('No variant match for flag "%s"', flagName);
        return {
          errorCode: ErrorCode.GENERAL,
          value: defaultValue,
          reason: flag.reason,
        };
      }

      const flagValue = flag.getValue(...pathParts);
      if (flagValue === null) {
        logger.warn('Value with path "%s" was not found in flag "%s"', pathParts.join('.'), flagName);
        return {
          errorCode: ErrorCode.PARSE_ERROR,
          value: defaultValue,
          reason: 'ERROR',
        };
      }

      if (!flagValue.match(defaultValue)) {
        logger.warn('Value for "%s" is of incorrect type', flagKey);
        return {
          errorCode: ErrorCode.TYPE_MISMATCH,
          value: defaultValue,
          reason: 'ERROR',
        };
      }
      if (flagValue.value === null) {
        logger.info('Value for "%s" is default', flagKey);
        return {
          value: defaultValue,
          reason: flag.reason,
        };
      }
      this.applyManager.apply(this.configuration.resolveToken, flagName);
      logger.info('Value for "%s" successfully evaluated', flagKey);
      return {
        value: flagValue.value,
        reason: 'TARGETING_MATCH',
        variant: flag.variant,
        flagMetadata: {
          resolveToken: this.configuration.resolveToken,
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
