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
  TrackingEventDetails,
} from '@openfeature/web-sdk';
import equal from 'fast-deep-equal';

import {
  ConfidenceClient,
  EvaluationContext as Context,
  FlagBundle,
  publishFlagEvaluation,
} from '@spotify-confidence/sdk';

/**
 * OpenFeature Provider for Confidence, for client side use.
 *
 * Implements the static paradigm: flags are resolved once per context and every
 * evaluation reads from that resolve, which is what makes evaluation synchronous.
 * @public
 */
export class ConfidenceWebProvider implements Provider {
  /** Static data about the provider */
  readonly metadata: ProviderMetadata = {
    name: 'ConfidenceWebProvider',
  };
  /** Events can be used by developers to track lifecycle events */
  readonly events = new OpenFeatureEventEmitter();

  private readonly client: ConfidenceClient;
  private readonly timeout: number;
  private readonly applyDebounce: number;

  /**
   * What every evaluation reads. A failed resolve is stored too, so evaluations
   * report why they are returning defaults instead of claiming the flags are
   * missing.
   */
  private bundle?: FlagBundle;
  /** Exposure for `bundle`. Absent until a resolve produces a token to apply against. */
  private exposure?: ExposureBatch;
  /**
   * Aborts the in-flight resolve. Doubles as the identity of the resolve that
   * owns provider state: only the newest one may write it.
   */
  private pending?: AbortController;

  constructor(client: ConfidenceClient, { timeout, applyDebounce = 10 }: { timeout: number; applyDebounce?: number }) {
    this.client = client;
    this.timeout = timeout;
    this.applyDebounce = applyDebounce;
  }

  /**
   * Resolve the flags for the initial context.
   *
   * Rejects when the resolve fails, which is how OpenFeature is told to put the
   * provider in ERROR.
   */
  async initialize(context?: EvaluationContext): Promise<void> {
    await this.resolve(context ?? {}, 'Provider initialization failed');
  }

  /** Re-resolve for a new context, replacing what evaluations read */
  async onContextChange(oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void> {
    // OpenFeature calls this on every setContext, including ones that changed
    // nothing worth re-resolving for.
    if (equal(oldContext, newContext)) return;
    this.events.emit(ProviderEvents.Stale);
    const owned = await this.resolve(newContext, 'Provider context change failed');
    // A newer context change took over. It announces its own result, and this
    // one has nothing left to announce.
    if (!owned) return;
    this.events.emit(ProviderEvents.Ready);
    this.events.emit(ProviderEvents.ConfigurationChanged);
  }

  /** Abandons any in-flight resolve and records exposure collected so far */
  async onClose(): Promise<void> {
    this.pending?.abort();
    this.pending = undefined;
    this.exposure?.flush();
    this.exposure = undefined;
    this.bundle = undefined;
  }

  /** Resolves and stores the result. False when a newer resolve took the state over. */
  private async resolve(context: EvaluationContext, failureMessage: string): Promise<boolean> {
    this.pending?.abort();
    const controller = new AbortController();
    this.pending = controller;
    // The client has no timeout option: one signal covers both the deadline and
    // being superseded. Aborting with a `TimeoutError` is what makes the client
    // report a deadline rather than a cancellation.
    const timer = setTimeout(() => controller.abort(new DOMException('Resolve timeout', 'TimeoutError')), this.timeout);
    try {
      // `apply: false` — a client resolves every flag it might need, so exposure
      // waits until a flag is actually evaluated. See concepts/apply.md.
      const bundle = await this.client.resolve([], convertContext(context), {
        apply: false,
        signal: controller.signal,
      });
      // A newer resolve took over while this one was in flight. It owns the
      // state now, and writing here would bring back an outdated context.
      if (this.pending !== controller) return false;
      this.setBundle(bundle);
      if (bundle.errorCode) throw new Error(`${failureMessage}: ${bundle.errorMessage}`);
      return true;
    } finally {
      clearTimeout(timer);
      if (this.pending === controller) this.pending = undefined;
    }
  }

  private setBundle(bundle: FlagBundle): void {
    // The outgoing token is the only thing that can apply the outgoing flags, so
    // anything collected against it has to go out before it is dropped.
    this.exposure?.flush();
    this.bundle = bundle;
    this.exposure = bundle.resolveToken
      ? new ExposureBatch(this.client, bundle.resolveToken, this.applyDebounce)
      : undefined;
  }

  private evaluateFlag<T extends FlagBundle.Value>(flagKey: string, defaultValue: T): ResolutionDetails<T> {
    if (!this.bundle) {
      return {
        value: defaultValue,
        reason: 'ERROR',
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        errorMessage: 'Provider not ready',
      };
    }

    const details = FlagBundle.evaluate(this.bundle, flagKey, defaultValue);
    // A dot path reads into the flag value; exposure belongs to the flag itself.
    const flagName = flagKey.split('.')[0];
    if (details.shouldApply) this.exposure?.add(flagName);
    if (details.reason === 'MATCH' && details.variant) {
      publishFlagEvaluation(flagName, details.variant, details.assignmentOrigin ?? '');
    }
    return toResolutionDetails(details);
  }

  /** Resolves with an evaluation of a Boolean flag */
  resolveBooleanEvaluation(flagKey: string, defaultValue: boolean): ResolutionDetails<boolean> {
    return this.evaluateFlag(flagKey, defaultValue);
  }

  /** Resolves with an evaluation of a Number flag */
  resolveNumberEvaluation(flagKey: string, defaultValue: number): ResolutionDetails<number> {
    return this.evaluateFlag(flagKey, defaultValue);
  }

  /** Resolves with an evaluation of an Object flag */
  resolveObjectEvaluation<T extends JsonValue>(flagKey: string, defaultValue: T): ResolutionDetails<T> {
    // JsonValue allows arrays, which are not valid flag values. Evaluation
    // reports that as a TYPE_MISMATCH rather than throwing.
    return this.evaluateFlag(flagKey, defaultValue as FlagBundle.Value) as ResolutionDetails<T>;
  }

  /** Resolves with an evaluation of a String flag */
  resolveStringEvaluation(flagKey: string, defaultValue: string): ResolutionDetails<string> {
    return this.evaluateFlag(flagKey, defaultValue);
  }

  /**
   * Sends an event to Confidence.
   *
   * The context comes from OpenFeature, which passes the effective evaluation
   * context on every call — deliberately not the context of the last resolve,
   * which may be older than what the event should be attributed to.
   *
   * The OpenFeature signature is synchronous, so this cannot report back: the
   * request is fired and forgotten. `publish` never rejects and logs its own
   * failures, so nothing is lost silently.
   */
  track(trackingEventName: string, context?: EvaluationContext, trackingEventDetails?: TrackingEventDetails): void {
    void this.client.publish({
      name: trackingEventName,
      // Context last: tracking details are an open record, so they may carry a
      // `context` key of their own, which must not displace the real one.
      payload: { ...trackingEventDetails, context: convertContext(context ?? {}) },
    });
  }
}

/**
 * Batched access-apply for one resolve.
 *
 * Exposure trickles in one evaluation at a time, so the window collects a
 * render's worth of them into a single request. Bound to the resolve token it
 * was created with: a token only permits applying the flags it was minted for.
 */
class ExposureBatch {
  private readonly applied = new Set<string>();
  private readonly pending = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly client: ConfidenceClient,
    private readonly resolveToken: string,
    private readonly debounce: number,
  ) {}

  add(flagName: string): void {
    // Applying the same flag twice records nothing extra.
    if (this.applied.has(flagName)) return;
    this.applied.add(flagName);
    this.pending.add(flagName);

    if (this.debounce === 0) {
      this.flush();
      return;
    }
    // Debounced rather than throttled, matching the Confidence SDK: the window
    // restarts on each evaluation so a burst leaves as one request.
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.debounce);
  }

  flush(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.pending.size === 0) return;
    const flagNames = Array.from(this.pending);
    this.pending.clear();
    // Fire and forget: `apply` never rejects and logs its own failures, and no
    // evaluation should wait on exposure being recorded.
    void this.client.apply(this.resolveToken, flagNames);
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
