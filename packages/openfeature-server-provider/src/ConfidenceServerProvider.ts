import {
  ErrorCode,
  EvaluationContext,
  EvaluationContextValue,
  JsonValue,
  Provider,
  ProviderMetadata,
  ProviderStatus,
  ResolutionDetails,
  TrackingEventDetails,
} from '@openfeature/server-sdk';

import { ConfidenceClient, EvaluationContext as Context, FlagBundle } from '@spotify-confidence/sdk';

/**
 * OpenFeature Provider for Confidence, for server side use.
 *
 * Implements the dynamic paradigm: each evaluation resolves the flag it needs
 * against the context it was given, so there is no state and nothing to
 * initialize.
 * @public
 */
export class ConfidenceServerProvider implements Provider {
  /** Static data about the provider */
  readonly metadata: ProviderMetadata = {
    name: 'ConfidenceServerProvider',
  };
  /** Current status of the provider. There is nothing to set up, so it is READY from the start. */
  status: ProviderStatus = ProviderStatus.READY;

  private readonly client: ConfidenceClient;
  private readonly timeout: number;
  private readonly writes = new Set<Promise<void>>();

  constructor(client: ConfidenceClient, { timeout }: { timeout: number }) {
    this.client = client;
    this.timeout = timeout;
  }

  private async evaluateFlag<T extends FlagBundle.Value>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<T>> {
    // Only the flag being evaluated is resolved, and the resolve applies it: on a
    // server a resolve *is* the access, so backend apply records exposure for
    // exactly the flag that was asked for. See concepts/apply.md.
    const flagName = flagKey.split('.')[0];
    const bundle = await this.client.resolve([flagName], convertContext(context), {
      signal: AbortSignal.timeout(this.timeout),
    });
    return toResolutionDetails(FlagBundle.evaluate(bundle, flagKey, defaultValue));
  }

  /** Resolves with an evaluation of a Boolean flag */
  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<boolean>> {
    return this.evaluateFlag(flagKey, defaultValue, context);
  }

  /** Resolves with an evaluation of a Numbers flag */
  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<number>> {
    return this.evaluateFlag(flagKey, defaultValue, context);
  }

  /** Resolves with an evaluation of an Object flag */
  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<T>> {
    // JsonValue allows arrays, which are not valid flag values. Evaluation
    // reports that as a TYPE_MISMATCH rather than throwing.
    return this.evaluateFlag(flagKey, defaultValue as FlagBundle.Value, context) as Promise<ResolutionDetails<T>>;
  }

  /** Resolves with an evaluation of a String flag */
  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<string>> {
    return this.evaluateFlag(flagKey, defaultValue, context);
  }

  /**
   * Sends an event to Confidence.
   *
   * The OpenFeature signature is synchronous, so this cannot report back: the
   * request is started immediately and drained on close. Failures are reported
   * through the configured logger.
   */
  track(trackingEventName: string, context?: EvaluationContext, trackingEventDetails?: TrackingEventDetails): void {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('Write timeout', 'TimeoutError')), this.timeout);
    const pending = this.client
      .publish(
        {
          name: trackingEventName,
          // Context last: tracking details are an open record, so they may carry a
          // `context` key of their own, which must not displace the real one.
          payload: { ...trackingEventDetails, context: convertContext(context ?? {}) },
        },
        { signal: controller.signal },
      )
      .then(() => {
        clearTimeout(timer);
        this.writes.delete(pending);
      });
    this.writes.add(pending);
  }

  async onClose(): Promise<void> {
    await Promise.all(this.writes);
  }
}

function toResolutionDetails<T>({
  value,
  reason,
  variant,
  errorCode,
  errorMessage,
}: FlagBundle.Details<T>): ResolutionDetails<T> {
  if (errorCode) return { value, reason, errorCode: mapErrorCode(errorCode), errorMessage };
  // A flag that matched nothing has no variant to report.
  return variant ? { value, reason, variant } : { value, reason };
}

function mapErrorCode(errorCode: FlagBundle.ErrorCode): ErrorCode {
  switch (errorCode) {
    case 'FLAG_NOT_FOUND':
      return ErrorCode.FLAG_NOT_FOUND;
    case 'TYPE_MISMATCH':
      return ErrorCode.TYPE_MISMATCH;
    // OpenFeature has no code for a timeout; a resolve that never arrived is
    // as general a failure as any.
    default:
      return ErrorCode.GENERAL;
  }
}

function convertContext({ targetingKey, ...context }: EvaluationContext): Context {
  const targetingContext = typeof targetingKey !== 'undefined' ? { targeting_key: targetingKey } : {};
  return { ...targetingContext, ...convertStruct(context) };
}

function convertValue(value: EvaluationContextValue): unknown {
  if (typeof value === 'object') {
    // Undefined rather than null: targeting treats an absent attribute and a
    // null one differently, and JSON.stringify drops undefined for us.
    if (value === null) return undefined;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(convertValue);
    return convertStruct(value);
  }
  return value;
}

function convertStruct(value: { [key: string]: EvaluationContextValue }): Record<string, unknown> {
  const struct: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (typeof value[key] === 'undefined') continue;
    struct[key] = convertValue(value[key]);
  }
  return struct;
}
