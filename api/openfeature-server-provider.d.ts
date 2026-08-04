import { Provider, ProviderMetadata, ProviderStatus, EvaluationContext, ResolutionDetails, JsonValue } from '@openfeature/server-sdk';
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
}

/**
 * Factory Options for Confidence Server Provider
 * @public */
type ConfidenceProviderFactoryOptions = {
    /** Credentials identifying the client and the flags available to it */
    clientSecret: string;
    /** Milliseconds to wait for a resolve. Past it, flags evaluate to their defaults */
    timeout: number;
    /** Sets the resolver region. Defaults to the global region */
    region?: 'eu' | 'us';
    /** Sets an alternative resolve url */
    resolveBaseUrl?: string;
    /** fetch-compatible transport. Defaults to the global fetch */
    fetchImplementation?: typeof fetch;
    /** Reports resolve failures. Defaults to the console in development */
    logger?: Logger;
};
/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param options - Options for Confidence Provider
 * @public */
declare function createConfidenceServerProvider(options: ConfidenceProviderFactoryOptions): Provider;

export { type ConfidenceProviderFactoryOptions, ConfidenceServerProvider, createConfidenceServerProvider };
