import { Confidence, Context } from '@spotify-confidence/sdk';
import React, { createContext, FC, PropsWithChildren, useContext } from 'react';

const ConfidenceContext = createContext<Confidence | null>(null);

export const ConfidenceProvider: FC<PropsWithChildren<{ confidence: Confidence }>> = ({ confidence, children }) => (
  <ConfidenceContext.Provider value={confidence} children={children} />
);

export const WithConfidenceContext: FC<PropsWithChildren<{ context: Context }>> = ({ context, children }) => {
  const confidence = useConfidence();
  return <ConfidenceProvider confidence={confidence.withContext(context)}>{children}</ConfidenceProvider>;
};
export const useConfidence = () => {
  const confidence = useContext(ConfidenceContext);
  if (!confidence)
    throw new Error('No Confidence instance found, did you forget to wrap your component in ConfidenceProvider?');
  return confidence;
};

export function withContext(context: Context): <T extends JSX.IntrinsicAttributes>(wrapped: FC<T>) => FC<T> {
  function wrap<T extends JSX.IntrinsicAttributes>(Wrapped: FC<T>): FC<T> {
    return (props: T) => (
      <WithConfidenceContext context={context}>
        <Wrapped {...props} />
      </WithConfidenceContext>
    );
  }
  return wrap;
}
