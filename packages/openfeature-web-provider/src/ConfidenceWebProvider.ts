import {
  EvaluationContext,
  FlagNotFoundError,
  GeneralError,
  InvalidContextError,
  JsonValue,
  Logger,
  OpenFeatureEventEmitter,
  ParseError,
  Provider,
  ProviderEvents,
  ProviderMetadata,
  ProviderStatus,
  ResolutionDetails,
  ResolutionReason,
  TypeMismatchError,
} from '@openfeature/web-sdk';
import equal from 'fast-deep-equal';

import { ApplyManager, ConfidenceClient, Configuration, ResolveContext } from '@spotify-confidence/client-http';

const APPLY_TIMEOUT = 250;

export interface ConfidenceWebProviderOptions {
  apply: 'access' | 'backend';
}

export class ConfidenceWebProvider implements Provider {
  readonly metadata: ProviderMetadata = {
    name: 'ConfidenceWebProvider',
  };
  status: ProviderStatus = ProviderStatus.NOT_READY;
  configuration: Configuration | null = null;
  readonly events = new OpenFeatureEventEmitter();

  private readonly client: ConfidenceClient;
  private readonly applyManager: ApplyManager | undefined = undefined;

  constructor(client: ConfidenceClient, options: ConfidenceWebProviderOptions) {
    this.client = client;
    if (options.apply !== 'backend') {
      this.applyManager = new ApplyManager({ client: this.client, timeout: APPLY_TIMEOUT });
    }
  }

  async initialize(context?: EvaluationContext): Promise<void> {
    try {
      this.configuration = await this.client.resolve(this.convertContext(context || {}), {
        flags: [],
      });
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
      throw new GeneralError('Provider not ready');
    }

    if (!equal(this.configuration.context, this.convertContext(context))) {
      return {
        value: defaultValue,
        reason: 'STALE',
      };
    }

    const [flagName, ...pathParts] = flagKey.split('.');

    const flag = this.configuration.flags[flagName];

    if (!flag) {
      logger.warn('Flag "%s" was not found', flagName);
      throw new FlagNotFoundError(`Flag "${flagName}" was not found`);
    }

    if (flag.reason === Configuration.ResolveReason.TargetingKeyError) {
      throw new InvalidContextError();
    }

    if (Configuration.ResolveReason.NoSegmentMatch === flag.reason) {
      this.applyManager?.apply(this.configuration.resolveToken, flagName);
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

    this.applyManager?.apply(this.configuration.resolveToken, flagName);
    return {
      value: flagValue.value === null ? defaultValue : (flagValue.value as T),
      reason: mapConfidenceReason(flag.reason),
      variant: flag.variant,
      flagMetadata: {
        resolveToken: this.configuration.resolveToken,
      },
    };
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
