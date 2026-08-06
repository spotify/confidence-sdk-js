import { Provider, ProviderMetadata, OpenFeatureEventEmitter, EvaluationContext, ResolutionDetails, JsonValue, TrackingEventDetails } from '@openfeature/web-sdk';
import { ConfidenceClient, Logger } from '@spotify-confidence/sdk';

/**
 * OpenFeature Provider for Confidence, for client side use.
 *
 * Implements the static paradigm: flags are resolved once per context and every
 * evaluation reads from that resolve, which is what makes evaluation synchronous.
 * @public
 */
declare class ConfidenceWebProvider implements Provider {
    /** Static data about the provider */
    readonly metadata: ProviderMetadata;
    /** Events can be used by developers to track lifecycle events */
    readonly events: OpenFeatureEventEmitter;
    private readonly client;
    private readonly timeout;
    private readonly applyDebounce;
    /**
     * What every evaluation reads. A failed resolve is stored too, so evaluations
     * report why they are returning defaults instead of claiming the flags are
     * missing.
     */
    private bundle?;
    /** Exposure for `bundle`. Absent until a resolve produces a token to apply against. */
    private exposure?;
    /**
     * Aborts the in-flight resolve. Doubles as the identity of the resolve that
     * owns provider state: only the newest one may write it.
     */
    private pending?;
    constructor(client: ConfidenceClient, { timeout, applyDebounce }: {
        timeout: number;
        applyDebounce?: number;
    });
    /**
     * Resolve the flags for the initial context.
     *
     * Rejects when the resolve fails, which is how OpenFeature is told to put the
     * provider in ERROR.
     */
    initialize(context?: EvaluationContext): Promise<void>;
    /** Re-resolve for a new context, replacing what evaluations read */
    onContextChange(oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void>;
    /** Abandons any in-flight resolve and records exposure collected so far */
    onClose(): Promise<void>;
    /** Resolves and stores the result. False when a newer resolve took the state over. */
    private resolve;
    private setBundle;
    private evaluateFlag;
    /** Resolves with an evaluation of a Boolean flag */
    resolveBooleanEvaluation(flagKey: string, defaultValue: boolean): ResolutionDetails<boolean>;
    /** Resolves with an evaluation of a Number flag */
    resolveNumberEvaluation(flagKey: string, defaultValue: number): ResolutionDetails<number>;
    /** Resolves with an evaluation of an Object flag */
    resolveObjectEvaluation<T extends JsonValue>(flagKey: string, defaultValue: T): ResolutionDetails<T>;
    /** Resolves with an evaluation of a String flag */
    resolveStringEvaluation(flagKey: string, defaultValue: string): ResolutionDetails<string>;
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
    track(trackingEventName: string, context?: EvaluationContext, trackingEventDetails?: TrackingEventDetails): void;
}

/**
 * Factory Options for Confidence Web Provider
 * @public */
type ConfidenceWebProviderOptions = {
    /** Credentials identifying the client and the flags available to it */
    clientSecret: string;
    /** Milliseconds to wait for a resolve. Past it, flags evaluate to their defaults */
    timeout: number;
    /** Pins flag resolution and event publishing to a region. Defaults to the global region */
    region?: 'eu' | 'us';
    /** fetch-compatible transport. Defaults to the global fetch */
    fetchImplementation?: typeof fetch;
    /**
     * Milliseconds to batch exposure over: flags evaluated within the window are
     * applied in one request. 0 applies each flag as it is evaluated.
     *
     * Defaults to 10.
     */
    applyDebounce?: number;
    /** Reports resolve and apply failures. Defaults to the console in development */
    logger?: Logger;
};
/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param options - Options for Confidence Provider
 * @public */
declare function createConfidenceWebProvider(options: ConfidenceWebProviderOptions): Provider;

export { ConfidenceWebProvider, createConfidenceWebProvider };
