import { Provider, ProviderMetadata, ProviderStatus, EvaluationContext, ResolutionDetails, JsonValue } from '@openfeature/server-sdk';
import { FlagResolver, Confidence } from '@spotify-confidence/sdk';

/**
 * OpenFeature Provider for Confidence Server SDK
 * @public
 */
declare class ConfidenceServerProvider implements Provider {
    /** Static data about the provider */
    readonly metadata: ProviderMetadata;
    /** Current status of the provider. Can be READY, NOT_READY, ERROR, STALE and FATAL. */
    status: ProviderStatus;
    private readonly confidence;
    constructor(client: FlagResolver);
    private fetchFlag;
    private mapErrorCode;
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
    region?: 'eu' | 'us';
    fetchImplementation?: typeof fetch;
    clientSecret: string;
    timeout: number;
    /** Sets an alternative resolve url */
    resolveBaseUrl?: string;
};
/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param options - Options for Confidence Provider
 * @public */
declare function createConfidenceServerProvider(options: ConfidenceProviderFactoryOptions): Provider;
/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param confidence - Confidence instance
 * @public */
declare function createConfidenceServerProvider(confidence: Confidence): Provider;

export { type ConfidenceProviderFactoryOptions, ConfidenceServerProvider, createConfidenceServerProvider };
