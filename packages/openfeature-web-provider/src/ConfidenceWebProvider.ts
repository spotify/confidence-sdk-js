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
  ResolutionDetails,
} from '@openfeature/web-sdk';
import equal from 'fast-deep-equal';

import { Value, Context, FlagResolver } from '@spotify-confidence/sdk';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export class ConfidenceWebProvider implements Provider {
  readonly metadata: ProviderMetadata = {
    name: 'ConfidenceWebProvider',
  };
  readonly events = new OpenFeatureEventEmitter();

  private unsubscribe?: () => void;
  private readonly confidence: FlagResolver;

  constructor(confidence: FlagResolver) {
    this.confidence = confidence;
  }

  async initialize(context?: EvaluationContext): Promise<void> {
    if (context) this.confidence.setContext(convertContext(context));
    let isStale = false;
    this.unsubscribe = this.confidence.subscribe(state => {
      if (state === 'READY') {
        if (isStale) {
          this.events.emit(ProviderEvents.Ready);
          this.events.emit(ProviderEvents.ConfigurationChanged);
          isStale = false;
        }
      } else if (state === 'STALE') {
        this.events.emit(ProviderEvents.Stale);
        isStale = true;
      }
    });
    return this.expectReadyOrTimeout();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  async onContextChange(oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void> {
    const changes = contextChanges(oldContext, newContext);
    if (Object.keys(changes).length === 0) {
      return Promise.resolve();
    }
    this.confidence.setContext(convertContext(changes));
    return this.expectReadyOrTimeout();
  }

  private expectReadyOrTimeout(): Promise<void> {
    const timeout = this.confidence.config.timeout;
    let close: () => void;
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Resolve timed out after ${timeout}ms`));
      }, timeout);
      close = this.confidence.subscribe(state => {
        if (state === 'READY') {
          resolve();
          clearTimeout(timeoutId);
        }
      });
    }).finally(close!);
  }

  private evaluateFlag<T extends Value>(
    flagKey: string,
    defaultValue: T,
    _context: EvaluationContext,
    _logger: Logger,
  ): ResolutionDetails<T> {
    const evaluation = this.confidence.evaluateFlag(flagKey, defaultValue);
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

function contextChanges(oldContext: EvaluationContext, newContext: EvaluationContext): EvaluationContext {
  const uniqueKeys = new Set([...Object.keys(newContext), ...Object.keys(oldContext)]);
  const changes: EvaluationContext = {};
  for (const key of uniqueKeys) {
    if (!equal(newContext[key], oldContext[key])) {
      if (key === 'targetingKey') {
        // targetingKey is a special case, it should never set to null but rather undefined
        changes[key] = newContext[key];
      } else {
        changes[key] = newContext[key] ?? null;
      }
    }
  }
  return changes;
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
