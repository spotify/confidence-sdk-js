import { Provider, ProviderMetadata, ProviderStatus, EvaluationContext, ResolutionDetails, JsonValue, TrackingEventDetails } from '@openfeature/server-sdk';
import { ConfidenceClient, Logger } from '@spotify-confidence/sdk';

/**
 * OpenFeature Provider for Confidence, for server side use.
 *
 * Implements the dynamic paradigm: each evaluation resolves the flag it needs
 * against the context it was given, so there is no state and nothing to
 * initialize.
 * @public
 */
declare class ConfidenceServerProvider implements Provider {
    /** Static data about the provider */
    readonly metadata: ProviderMetadata;
    /** Current status of the provider. There is nothing to set up, so it is READY from the start. */
    status: ProviderStatus;
    private readonly client;
    private readonly timeout;
    private readonly writes;
    constructor(client: ConfidenceClient, { timeout }: {
        timeout: number;
    });
    private evaluateFlag;
    /** Resolves with an evaluation of a Boolean flag */
    resolveBooleanEvaluation(flagKey: string, defaultValue: boolean, context: EvaluationContext): Promise<ResolutionDetails<boolean>>;
    /** Resolves with an evaluation of a Numbers flag */
    resolveNumberEvaluation(flagKey: string, defaultValue: number, context: EvaluationContext): Promise<ResolutionDetails<number>>;
    /** Resolves with an evaluation of an Object flag */
    resolveObjectEvaluation<T extends JsonValue>(flagKey: string, defaultValue: T, context: EvaluationContext): Promise<ResolutionDetails<T>>;
    /** Resolves with an evaluation of a String flag */
    resolveStringEvaluation(flagKey: string, defaultValue: string, context: EvaluationContext): Promise<ResolutionDetails<string>>;
    /**
     * Sends an event to Confidence.
     *
     * The OpenFeature signature is synchronous, so this cannot report back: the
     * request is started immediately and drained on close. Failures are reported
     * through the configured logger.
     */
    track(trackingEventName: string, context?: EvaluationContext, trackingEventDetails?: TrackingEventDetails): void;
    onClose(): Promise<void>;
}

/**
 * Factory Options for Confidence Server Provider
 * @public */
type ConfidenceProviderFactoryOptions = {
    /** Credentials identifying the client and the flags available to it */
    clientSecret: string;
    /** Deadline in milliseconds for each resolve or event request */
    timeout: number;
    /** Pins flag resolution and event publishing to a region. Defaults to the global region */
    region?: 'eu' | 'us';
    /** fetch-compatible transport. Defaults to the global fetch */
    fetchImplementation?: typeof fetch;
    /** Reports resolve and event failures. Defaults to the console in development */
    logger?: Logger;
};
/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param options - Options for Confidence Provider
 * @public */
declare function createConfidenceServerProvider(options: ConfidenceProviderFactoryOptions): Provider;

export { type ConfidenceProviderFactoryOptions, ConfidenceServerProvider, createConfidenceServerProvider };
