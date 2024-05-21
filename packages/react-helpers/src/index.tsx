import { Confidence, Context, Value, FlagEvaluation } from '@spotify-confidence/sdk';
import React, { createContext, FC, PropsWithChildren, useContext, useMemo, useSyncExternalStore } from 'react';

const ConfidenceContext = createContext<Confidence | null>(null);

export const ConfidenceProvider: FC<PropsWithChildren<{ confidence: Confidence }>> = ({ confidence, children }) => (
  <ConfidenceContext.Provider value={confidence} children={children} />
);

export const WithContext: FC<PropsWithChildren<{ context: Context }>> = ({ context, children }) => {
  return <ConfidenceProvider confidence={useConfidence(context)}>{children}</ConfidenceProvider>;
};

export const useConfidence = (withContext?: Context): Confidence => {
  const parent = useContext(ConfidenceContext);
  if (!parent)
    throw new Error('No Confidence instance found, did you forget to wrap your component in ConfidenceProvider?');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (withContext ? parent.withContext(withContext) : parent), [parent, JSON.stringify(withContext)]);
};

export function useFlagValue<T extends Value>(path: string, defaultValue: T): T {
  return useFlagEvaluation(path, defaultValue).value;
}

export function useFlagEvaluation<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
  const confidence = useConfidence();
  const [subscribe, getSnapshot] = useMemo(
    () => createFlagEvaluationStore(confidence, path, defaultValue),
    [confidence, path, defaultValue],
  );
  const json = useSyncExternalStore(subscribe, getSnapshot);
  return JSON.parse(json);
}

type SyncExternalStore<T> = [subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => T];

function createFlagEvaluationStore(confidence: Confidence, path: string, defaultValue: any): SyncExternalStore<string> {
  const getSnapshot = () => {
    const evaluation = confidence.evaluateFlag(path, defaultValue);
    if ('then' in evaluation) throw evaluation;
    return JSON.stringify(evaluation);
  };
  const subscribe = (onStoreChange: () => void) => {
    const close = confidence.subscribe(state => {
      if (state === 'READY') onStoreChange();
    });
    return close;
  };
  return [subscribe, getSnapshot];
}
