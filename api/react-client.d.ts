import { ConfidenceOptions, Confidence, Context, FlagEvaluation, Value } from '@spotify-confidence/sdk';
import { FC, PropsWithChildren, ReactNode } from 'react';

declare const ManagedConfidenceProvider: FC<PropsWithChildren<{
    options: ConfidenceOptions | PromiseLike<ConfidenceOptions>;
}>>;
/**
 * Confidence Provider for React
 * @public
 */
interface ConfidenceProvider {
    (props: {
        confidence: Confidence;
        children?: ReactNode;
    }): ReactNode;
    WithContext: FC<PropsWithChildren<{
        context: Context;
    }>>;
}
/**
 * Confidence Provider for React
 * @public
 */
declare const ConfidenceProvider: ConfidenceProvider;
/**
 * Enables using Confidence
 * @public
 */
declare const useConfidence: () => Confidence;
/**
 * Use with given Confidence Context
 * @public
 */
declare function useWithContext(context: Context, parent?: Confidence): Confidence;
/**
 * Use Confidence Context
 * @public
 */
declare function useConfidenceContext(confidence?: Confidence): Context;
/**
 * Use EvaluateFlag
 * @public */
declare function useEvaluateFlag(path: string, defaultValue: string, confidence?: Confidence): FlagEvaluation<string>;
declare function useEvaluateFlag(path: string, defaultValue: number, confidence?: Confidence): FlagEvaluation<number>;
declare function useEvaluateFlag(path: string, defaultValue: boolean, confidence?: Confidence): FlagEvaluation<boolean>;
declare function useEvaluateFlag<T extends Value>(path: string, defaultValue: T, confidence?: Confidence): FlagEvaluation<T>;
/**
 * Use Flag
 * @public
 */
declare function useFlag(path: string, defaultValue: string, confidence?: Confidence): string;
declare function useFlag(path: string, defaultValue: number, confidence?: Confidence): number;
declare function useFlag(path: string, defaultValue: boolean, confidence?: Confidence): boolean;
declare function useFlag<T extends Value>(path: string, defaultValue: T, confidence?: Confidence): T;

export { ConfidenceProvider, ManagedConfidenceProvider, useConfidence, useConfidenceContext, useEvaluateFlag, useFlag, useWithContext };
