import { cache, FC, ReactNode } from 'react';
import { ServerToClientProvider } from './client';
import { Confidence, isServer } from './confidence';

const storage = new AsyncLocalStorage<Confidence>();

export const getCache = cache(() => ({}));

export const ConfidenceProvider: FC<{ value: Confidence; children?: ReactNode }> = ({ value, children }) => {
  console.log('ConfidenceProvider', isServer());
  const root = value;
  storage.enterWith(root);

  return <ServerToClientProvider data={root.toJSON()}>{children}</ServerToClientProvider>;
};

export const useConfidence = (): Confidence => {
  const confidence = storage.getStore();
  if (!confidence) {
    throw new Error('ConfidenceProvider is missing');
  }
  return confidence;
};

// export function useFlag<T>(name: string, defaultValue: T): Flag<T> {
//   const confidence = useConfidence();
//   return confidence.getFlag(name, defaultValue);
// }
