import { EventSender, Trackable, FlagResolver, Confidence, Configuration, Value, Closer, Context, StateObserver, FlagEvaluation } from '@spotify-confidence/sdk';
import { FC, PropsWithChildren } from 'react';

/**
 * Confidence React instance
 * @public
 */
declare class ConfidenceReact implements EventSender, Trackable, FlagResolver {
    /**
     * Confidence Delegate
     *  @internal */
    readonly delegate: Confidence;
    constructor(delegate: Confidence);
    /** Return configurations of the Confidence instance */
    get config(): Configuration;
    /**
     * Current serialized Context
     * @internal */
    get contextState(): string;
    /**
     * Tracks an event
     * @param name - event name
     * @param message - data to track */
    track(name: string, message?: Value.Struct): void;
    /**
     * Tracks an event
     * @param manager - trackable manager */
    track(manager: Trackable.Manager): Closer;
    /** Returns context of the current Confidence instance */
    getContext(): Context;
    /** Set Confidence context */
    setContext(context: Context, { transition }?: {
        transition?: boolean | undefined;
    }): void;
    /** Subscribe to flag changes in Confidence */
    subscribe(onStateChange?: StateObserver | undefined): () => void;
    /** Clears context of current Confidence instance */
    clearContext({ transition }?: {
        transition?: boolean | undefined;
    }): void;
    /**
     * Creates a new ConfidenceReact instance with context
     * @param context - Confidence context
     * @returns ConfidenceReact instance
     */
    withContext(context: Context): ConfidenceReact;
    /** Evaluates a flag */
    evaluateFlag(path: string, defaultValue: string): FlagEvaluation<string>;
    evaluateFlag(path: string, defaultValue: boolean): FlagEvaluation<boolean>;
    evaluateFlag(path: string, defaultValue: number): FlagEvaluation<number>;
    evaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T>;
    /** Returns flag value for a given flag */
    getFlag(path: string, defaultValue: string): Promise<string>;
    getFlag(path: string, defaultValue: boolean): Promise<boolean>;
    getFlag(path: string, defaultValue: number): Promise<number>;
    getFlag<T extends Value>(path: string, defaultValue: T): Promise<T>;
    /** Hook to access Context */
    useContext(): Context;
    /** Hook to access the WithContext functionality. Returns a  ConfidenceReact instance with the passed context. */
    useWithContext(context: Context): ConfidenceReact;
    /** Hook to use EvaluateFlag functionality */
    useEvaluateFlag(path: string, defaultValue: string): FlagEvaluation<string>;
    useEvaluateFlag(path: string, defaultValue: number): FlagEvaluation<number>;
    useEvaluateFlag(path: string, defaultValue: boolean): FlagEvaluation<boolean>;
    useEvaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T>;
    /** Hook to use getFlag functionality */
    useFlag(path: string, defaultValue: string): string;
    useFlag(path: string, defaultValue: number): number;
    useFlag(path: string, defaultValue: boolean): boolean;
    useFlag<T extends Value>(path: string, defaultValue: T): T;
    private assertContext;
}
/**
 * Confidence Provider for React
 * @public
 */
type ConfidenceProvider = FC<PropsWithChildren<{
    confidence: Confidence;
}>> & {
    WithContext: FC<PropsWithChildren<{
        context: Context;
    }>>;
};
/**
 * Confidence Provider for React
 * @public
 */
declare const ConfidenceProvider: ConfidenceProvider;
/**
 * Enables using Confidence
 * @public
 */
declare const useConfidence: () => ConfidenceReact;
/**
 * Use with given Confidence Context
 * @public
 */
declare function useWithContext(context: Context, parent?: ConfidenceReact): ConfidenceReact;
/**
 * Use Confidence Context
 * @public
 */
declare function useConfidenceContext(confidence?: ConfidenceReact): Context;
/**
 * Use EvaluateFlag
 * @public */
declare function useEvaluateFlag(path: string, defaultValue: string, confidence?: ConfidenceReact): FlagEvaluation<string>;
declare function useEvaluateFlag(path: string, defaultValue: number, confidence?: ConfidenceReact): FlagEvaluation<number>;
declare function useEvaluateFlag(path: string, defaultValue: boolean, confidence?: ConfidenceReact): FlagEvaluation<boolean>;
declare function useEvaluateFlag<T extends Value>(path: string, defaultValue: T, confidence?: ConfidenceReact): FlagEvaluation<T>;
/**
 * Use Flag
 * @public
 */
declare function useFlag(path: string, defaultValue: string, confidence?: ConfidenceReact): string;
declare function useFlag(path: string, defaultValue: number, confidence?: ConfidenceReact): number;
declare function useFlag(path: string, defaultValue: boolean, confidence?: ConfidenceReact): boolean;
declare function useFlag<T extends Value>(path: string, defaultValue: T, confidence?: ConfidenceReact): T;

export { ConfidenceProvider, ConfidenceReact, useConfidence, useConfidenceContext, useEvaluateFlag, useFlag, useWithContext };
