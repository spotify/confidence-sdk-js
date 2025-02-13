'use client';

import { createContext, ReactNode, use, useContext, useEffect, useMemo, useState } from 'react';
import { Cache, Confidence, Configuration, Context, Flags, getConfiguration, isServer } from './confidence';
import { AccessiblePromise } from './AccessiblePromise';

const reactContext = createContext<Confidence | null>(null);

const clientCache: Cache = {};
const seenPromises = new WeakSet<object>();

export const ConfidenceProvider = reactContext.Provider;

export const ServerToClientProvider: React.FC<{
  configuration: Configuration;
  context: Context;
  children?: ReactNode;
}> = ({ configuration, context, children }) => {
  console.log('got configuration', configuration);
  const confidence = new Confidence(
    isServer() ? getConfiguration(configuration.id!)! : clientConfiguration(configuration),
    context,
  );
  console.log('ServerToClientProvider', context);
  return <ConfidenceProvider value={confidence}>{children}</ConfidenceProvider>;
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
  // debugger;
  const [value, setValue] = useState<T>(() => confidence.getFlag(name, defaultValue).orSuspend());
  useEffect(() => {
    confidence.subscribe(() => {
      setValue(confidence.getFlag(name, defaultValue).orThrow());
    });
  }, [confidence]);
  return value;
}

function fixReactPromise(promise: any): AccessiblePromise<Flags> {
  switch (promise.status) {
    case 'fulfilled':
      return AccessiblePromise.resolve(promise.value);
    case 'rejected':
      return AccessiblePromise.reject(promise.value);
    default:
      return AccessiblePromise.resolve(Promise.resolve(promise));
  }
}

function clientConfiguration({ flagResolver, cache = {}, ...config }: Configuration): Configuration {
  const fixedCache: Cache = Object.fromEntries(
    Object.entries(cache).map(([key, value]) => [key, fixReactPromise(value)]),
  );
  return {
    ...config,
    flagResolver: (ctx: Context) => {
      const key = JSON.stringify(ctx);
      let flags = fixedCache[key];
      if (!flags) {
        flags = fixedCache[key] = AccessiblePromise.resolve(flagResolver(ctx));
      }
      return flags;
    },
  };
}
