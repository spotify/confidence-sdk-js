import { Provider, ProviderMetadata, OpenFeatureEventEmitter, EvaluationContext, ResolutionDetails, JsonValue } from '@openfeature/web-sdk';
import { FlagResolver, Confidence } from '@spotify-confidence/sdk';

/**
 * OpenFeature Provider for Confidence Web SDK
 * @public
 */
declare class ConfidenceWebProvider implements Provider {
    /** Static data about the provider */
    readonly metadata: ProviderMetadata;
    /** Events can be used by developers to track lifecycle events */
    readonly events: OpenFeatureEventEmitter;
    private unsubscribe?;
    private readonly confidence;
    constructor(confidence: FlagResolver);
    /** Initialize the Provider */
    initialize(context?: EvaluationContext): Promise<void>;
    /** Function called on closing of a Provider, handles unsubscribing from the Confidence SDK */
    onClose(): Promise<void>;
    /** Called on Confidence Context change */
    onContextChange(oldContext: EvaluationContext, newContext: EvaluationContext): Promise<void>;
    private expectReadyOrError;
    private evaluateFlag;
    private mapErrorCode;
    /** Resolves with an evaluation of a Boolean flag */
    resolveBooleanEvaluation(flagKey: string, defaultValue: boolean): ResolutionDetails<boolean>;
    /** Resolves with an evaluation of a Number flag */
    resolveNumberEvaluation(flagKey: string, defaultValue: number): ResolutionDetails<number>;
    /** Resolves with an evaluation of an Object flag */
    resolveObjectEvaluation<T extends JsonValue>(flagKey: string, defaultValue: T): ResolutionDetails<T>;
    /** Resolves with an evaluation of a String flag */
    resolveStringEvaluation(flagKey: string, defaultValue: string): ResolutionDetails<string>;
}

/**
 * Factory Options for Confidence Web Provider
 * @public */
type ConfidenceWebProviderOptions = {
    region?: 'eu' | 'us';
    fetchImplementation?: typeof fetch;
    clientSecret: string;
    timeout: number;
    /** Sets an alternative resolve url */
    resolveBaseUrl?: string;
    /** Sets an alternative apply url */
    applyBaseUrl?: string;
};
/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param options - Options for Confidence Provider
 * @public */
declare function createConfidenceWebProvider(options: ConfidenceWebProviderOptions): Provider;
/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param confidence - Confidence instance
 * @public */
declare function createConfidenceWebProvider(confidence: Confidence): Provider;

export { ConfidenceWebProvider, createConfidenceWebProvider };
