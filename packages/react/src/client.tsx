'use client';
import { Confidence, Value, FlagEvaluation, Context, ConfidenceOptions } from '@spotify-confidence/sdk';
import React, {
  createContext,
  FC,
  PropsWithChildren,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
  FunctionComponent,
} from 'react';

const isServer = typeof window === 'undefined';
const ConfidenceContext = createContext<Confidence | null>(null);

const _ConfidenceProvider = (props: { confidence: Confidence; children?: ReactNode }) => {
  return <ConfidenceContext.Provider value={props.confidence} children={props.children} />;
};

const WithContext: FC<PropsWithChildren<{ context: Context }>> = ({ context, children }) => {
  const child = useWithContext(context);
  return <ConfidenceContext.Provider value={child}>{children}</ConfidenceContext.Provider>;
};

declare function assertNever<T extends never>(): void;

export const ManagedConfidenceProvider: FC<PropsWithChildren<{ options: ConfidenceOptions }>> = ({
  options,
  children,
}) => {
  const { cache, ...optionsDeluxe } = options;
  const confidence = useMemo(() => {
    console.log('Creating confidence with options', options);
    return Confidence.create({
      ...options,
      environment: 'client',
    });
  }, Object.values(optionsDeluxe));
  return _ConfidenceProvider({ confidence, children });
};
/**
 * Confidence Provider for React
 * @public
 */
export interface ConfidenceProvider extends FunctionComponent<{ confidence: Confidence; children?: ReactNode }> {
  WithContext: FC<PropsWithChildren<{ context: Context }>>;
}
/**
 * Confidence Provider for React
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ConfidenceProvider: ConfidenceProvider = Object.assign(_ConfidenceProvider, { WithContext });

/**
 * Enables using Confidence
 * @public
 */
export const useConfidence = (): Confidence => {
  const confidence = useContext(ConfidenceContext);
  if (!confidence)
    throw new Error('No Confidence instance found, did you forget to wrap your component in ConfidenceProvider?');
  return confidence;
};

/**
 * Use with given Confidence Context
 * @public
 */
// eslint-disable-next-line react-hooks/rules-of-hooks
export function useWithContext(context: Context, parent = useConfidence()): Confidence {
  const child = useMemo(
    () => parent.withContext(context),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parent, Value.serialize(context)],
  );

  return child;
}

/**
 * Use Confidence Context
 * @public
 */
// this would be better named useContext, but would then collide with React.useContext
// eslint-disable-next-line react-hooks/rules-of-hooks
export function useConfidenceContext(confidence = useConfidence()): Context {
  const [, setState] = useState(Value.serialize(confidence.getContext()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(confidence.contextChanges(() => setState(Value.serialize(confidence.getContext()))));
  return confidence.getContext();
}

/**
 * Use EvaluateFlag
 * @public */
export function useEvaluateFlag(path: string, defaultValue: string, confidence?: Confidence): FlagEvaluation<string>;
export function useEvaluateFlag(path: string, defaultValue: number, confidence?: Confidence): FlagEvaluation<number>;
export function useEvaluateFlag(path: string, defaultValue: boolean, confidence?: Confidence): FlagEvaluation<boolean>;
export function useEvaluateFlag<T extends Value>(
  path: string,
  defaultValue: T,
  confidence?: Confidence,
): FlagEvaluation<T>;
export function useEvaluateFlag<T extends Value>(
  path: string,
  defaultValue: T,
  // eslint-disable-next-line react-hooks/rules-of-hooks
  confidence = useConfidence(),
): FlagEvaluation<T> {
  const evaluation = confidence.evaluateFlag(path, defaultValue);
  const [, setState] = useState(() => Value.serialize(confidence.getContext()));
  useEffect(() => {
    return confidence.subscribe(() => {
      setState(Value.serialize(confidence.getContext()));
    });
  });
  if ('then' in evaluation) {
    if (isServer) {
      throw Object.assign(new Error('Flags are not fetched in SSR'), { digest: 'BAILOUT_TO_CLIENT_SIDE_RENDERING' });
    }
    throw evaluation;
  }
  return evaluation;
}

/**
 * Use Flag
 * @public
 */
export function useFlag(path: string, defaultValue: string, confidence?: Confidence): string;
export function useFlag(path: string, defaultValue: number, confidence?: Confidence): number;
export function useFlag(path: string, defaultValue: boolean, confidence?: Confidence): boolean;
export function useFlag<T extends Value>(path: string, defaultValue: T, confidence?: Confidence): T;
// eslint-disable-next-line react-hooks/rules-of-hooks
export function useFlag<T extends Value>(path: string, defaultValue: T, confidence = useConfidence()): T {
  return useEvaluateFlag(path, defaultValue, confidence).value;
}
