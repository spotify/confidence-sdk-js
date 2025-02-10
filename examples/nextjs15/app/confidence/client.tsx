'use client';

import { createContext, ReactNode, use, useContext, useEffect, useState } from 'react';
import { Confidence } from './confidence';
import { AccessiblePromise } from './AccessiblePromise';

const reactContext = createContext<Confidence>(null);

export const ConfidenceProvider = reactContext.Provider;

export const ServerToClientProvider: React.FC<{ data: any; children?: ReactNode }> = ({
  data: { cache, context },
  children,
}) => {
  const fixedCache = Object.fromEntries(
    Object.entries(cache).map(([key, value]) => [key, AccessiblePromise.resolve(Promise.resolve(value))]),
  );
  console.log('ServerToClientProvider', fixedCache, context);
  return <ConfidenceProvider value={new Confidence({ cache: fixedCache, context })}>{children}</ConfidenceProvider>;
};

export function useConfidence(): Confidence {
  const confidence = useContext(reactContext);
  if (!confidence) {
    throw new Error('ConfidenceProvider is missing');
  }
  return confidence;
}

export function useFlag<T>(name: string, defaultValue: T): T {
  const confidence = useConfidence();
  const [value, setValue] = useState<T>(confidence.getFlag(name, defaultValue).orSuspend());
  useEffect(() => {
    confidence.subscribe(() => {
      setValue(confidence.getFlag(name, defaultValue).orThrow());
    });
  }, [confidence]);
  return value;
}
