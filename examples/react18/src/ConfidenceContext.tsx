import { Confidence, Context } from '@spotify-confidence/sdk';
import { createContext, FC, PropsWithChildren, useContext, useMemo } from 'react';

const ConfidenceContext = createContext<Confidence | null>(null);

export const ConfidenceProvider: FC<PropsWithChildren<{ confidence: Confidence }>> = ({ confidence, children }) => (
  <ConfidenceContext.Provider value={confidence} children={children} />
);

export const WithConfidenceContext: FC<PropsWithChildren<{ context: Context }>> = ({ context, children }) => {
  return <ConfidenceProvider confidence={useConfidence(context)}>{children}</ConfidenceProvider>;
};

export const useConfidence = (withContext?: Context): Confidence => {
  const parent = useContext(ConfidenceContext);
  if (!parent)
    throw new Error('No Confidence instance found, did you forget to wrap your component in ConfidenceProvider?');

  return useMemo(() => {
    return withContext ? parent.withContext(withContext) : parent;
  }, [parent, JSON.stringify(withContext)]);
};
