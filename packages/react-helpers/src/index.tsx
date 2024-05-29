import { Confidence, Value, FlagEvaluation, Context } from '@spotify-confidence/sdk';
import React, { createContext, FC, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

const ConfidenceContext = createContext<Confidence | null>(null);

// declare module '@spotify-confidence/sdk' {
//   export interface SuspendablePromise<T> {
//     orSuspend(): T;
//   }
// }

export const ConfidenceProvider: FC<PropsWithChildren<{ confidence: Confidence }>> = ({ confidence, children }) => (
  <ConfidenceContext.Provider value={confidence} children={children} />
);

export const WithContext: FC<PropsWithChildren<{ context: Context }>> = ({ context, children }) => {
  // let optionalContext: Value.Struct | undefined;
  // if (Object.keys(context).length > 0) optionalContext = context;
  return <ConfidenceProvider confidence={useConfidence(context)}>{children}</ConfidenceProvider>;
};

export const useConfidence = (withContext?: Context): Confidence => {
  const parent = useContext(ConfidenceContext);
  if (!parent)
    throw new Error('No Confidence instance found, did you forget to wrap your component in ConfidenceProvider?');
  const [_, rerender] = useState(0);

  const child = useMemo(
    () => (withContext ? parent.withContext(withContext) : parent),
    [parent, Value.serialize(withContext)],
  );
  useEffect(
    () =>
      child.subscribe(_state => {
        if (_state === 'READY') rerender(value => value + 1);
        // rerender(value => value + 1);
      }),
    [child],
  );
  return child;
};

export function useFlagValue<T extends Value>(path: string, defaultValue: T): T {
  return useFlagEvaluation(path, defaultValue).value;
}

export function useFlagEvaluation<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
  const confidence = useConfidence();
  const [evaluation, setEvaluation] = useState(() => confidence.getFlag(path, defaultValue));
  useEffect(
    () =>
      confidence.subscribe(state => {
        console.log(state);
        setEvaluation(confidence.getFlag(path, defaultValue));
      }),
    [confidence, path, defaultValue],
  );
  if (evaluation.reason === 'ERROR' && 'then' in evaluation) {
    throw Promise.resolve(evaluation);
  }
  return evaluation;
}
