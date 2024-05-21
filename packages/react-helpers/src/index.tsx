import { Confidence, Value, FlagEvaluation } from '@spotify-confidence/sdk';
import React, { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from 'react';

const ConfidenceContext = createContext<Confidence | null>(null);

export const ConfidenceProvider: FC<PropsWithChildren<{ confidence: Confidence }>> = ({ confidence, children }) => (
  <ConfidenceContext.Provider value={confidence} children={children} />
);

// export const WithContext: FC<PropsWithChildren<{ context: Context }>> = ({ context, children }) => {
//   return <ConfidenceProvider confidence={useConfidence(context)}>{children}</ConfidenceProvider>;
// };

export const useConfidence = (): Confidence => {
  const parent = useContext(ConfidenceContext);
  if (!parent)
    throw new Error('No Confidence instance found, did you forget to wrap your component in ConfidenceProvider?');

  // return useMemo(() => (withContext ? parent.withContext(withContext) : parent), [parent, JSON.stringify(withContext)]);
  return parent;
};

export function useFlagValue<T extends Value>(path: string, defaultValue: T): T {
  return useFlagEvaluation(path, defaultValue).value;
}

export function useFlagEvaluation<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
  const confidence = useConfidence();
  const [evaluation, setEvaluation] = useState(() => confidence.evaluateFlag(path, defaultValue));
  useEffect(
    () =>
      confidence.subscribe(() => {
        setEvaluation(confidence.evaluateFlag(path, defaultValue));
      }),
    [confidence, path, defaultValue],
  );
  if ('then' in evaluation) {
    throw evaluation;
  }
  return evaluation;
}
