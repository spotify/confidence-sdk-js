import {
  ErrorCode,
  EvaluationContext,
  EvaluationContextValue,
  JsonValue,
  OpenFeatureEventEmitter,
  Provider,
  ProviderEvents,
  ProviderMetadata,
  ResolutionDetails,
} from '@openfeature/web-sdk';
import equal from 'fast-deep-equal';

import { Value, Context, FlagResolver, FlagEvaluation } from '@spotify-confidence/sdk';

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
    return this.expectReadyOrError();
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
    return this.expectReadyOrError();
  }

  private expectReadyOrError(): Promise<void> {
    let close: () => void;
    return new Promise<void>((resolve, reject) => {
      close = this.confidence.subscribe(state => {
        if (state === 'READY') {
          resolve();
        } else if (state === 'ERROR') {
          reject(new Error('Provider initialization failed'));
        }
      });
    }).finally(close!);
  }

  private evaluateFlag<T extends Value>(flagKey: string, defaultValue: T): ResolutionDetails<T> {
    const evaluation = this.confidence.evaluateFlag(flagKey, defaultValue) as FlagEvaluation<T>;
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

  resolveBooleanEvaluation(flagKey: string, defaultValue: boolean): ResolutionDetails<boolean> {
    return this.evaluateFlag(flagKey, defaultValue);
  }

  resolveNumberEvaluation(flagKey: string, defaultValue: number): ResolutionDetails<number> {
    return this.evaluateFlag(flagKey, defaultValue);
  }

  resolveObjectEvaluation<T extends JsonValue>(flagKey: string, defaultValue: T): ResolutionDetails<T> {
    // this might throw but will be caught by OpenFeature
    Value.assertValue(defaultValue);
    return this.evaluateFlag(flagKey, defaultValue);
  }

  resolveStringEvaluation(flagKey: string, defaultValue: string): ResolutionDetails<string> {
    return this.evaluateFlag(flagKey, defaultValue);
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
