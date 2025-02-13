import { cache, FC, ReactNode } from 'react';
import { ServerToClientProvider } from './client';
import {
  Confidence,
  isServer,
  Context,
  Flags,
  Configuration,
  Cache,
  addConfigurationMiddleware,
  getConfiguration,
} from './confidence';
import createServerContext from '@nimpl/context/create-server-context';
import getServerContext from '@nimpl/context/get-server-context';
import { AccessiblePromise } from './AccessiblePromise';

const ServerContext = createServerContext<Confidence>();

export const getCache = cache(() => ({} as Cache));

addConfigurationMiddleware(next => options => {
  const { flagResolver: nextFlagResolver, ...config } = next(options);
  return {
    ...config,
    flagResolver: ctx => {
      const cache = getCache();
      const key = JSON.stringify(ctx);
      let flags = cache[key];
      if (!flags) {
        flags = cache[key] = AccessiblePromise.resolve(nextFlagResolver(ctx));
      }
      return flags;
    },
    cache: getCache(),
  };
});

export const ConfidenceProvider: FC<{ value: Confidence; children?: ReactNode }> = ({ value, children }) => {
  console.log('ConfidenceProvider', value);
  const cache = getCache();
  const configuration = {
    ...value.configuration,
    flagResolver: flagResolver.bind(null, value.configuration.id!),
    cache,
  };
  return (
    <ServerContext.Provider value={value}>
      <ServerToClientProvider configuration={configuration} context={value.getContext()}>
        {children}
      </ServerToClientProvider>
    </ServerContext.Provider>
  );
};

export const useConfidence = (): Confidence => {
  const confidence = getServerContext(ServerContext);
  if (!confidence) {
    throw new Error('ConfidenceProvider is missing');
  }
  return confidence;
};

// export function useFlag<T>(name: string, defaultValue: T): Flag<T> {
//   const confidence = useConfidence();
//   return confidence.getFlag(name, defaultValue);
// }

async function flagResolver(id: string, ctx: Context): Promise<Flags> {
  'use server';
  console.log('resolving through server', ctx);
  return getConfiguration(id)!.flagResolver(ctx);
}
