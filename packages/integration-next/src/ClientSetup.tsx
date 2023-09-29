'use client';
import React, { useMemo } from 'react';
import { DefaultLogger, OpenFeature, OpenFeatureClient, OpenFeatureEventEmitter } from '@openfeature/web-sdk';
import { ConfidenceWebProvider, createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { OpenFeatureContextProvider } from '@spotify-confidence/integration-react';

type RequiredSelected<T, K extends keyof T> = {
  [P in K]-?: NonNullable<T[P]>;
} & T;

export interface ClientSetupProps {
  clientProviderFactoryOptions: RequiredSelected<
    Parameters<typeof createConfidenceWebProvider>[0],
    'initConfiguration'
  >;
  isServer?: boolean;
  fallback: React.ReactNode;
}

export function ClientSetup(props: React.PropsWithChildren<ClientSetupProps>) {
  const { clientProviderFactoryOptions, isServer = typeof window === 'undefined', children, fallback } = props;

  const clientProvider = useMemo((): ConfidenceWebProvider => {
    if (isServer) {
      return createConfidenceWebProvider({
        ...clientProviderFactoryOptions,
        fetchImplementation: _ => {
          throw new Error('Initial configuration not set correctly');
        },
      });
    }
    return createConfidenceWebProvider(clientProviderFactoryOptions);
  }, [clientProviderFactoryOptions, isServer]);

  useMemo(() => {
    if (!isServer) {
      OpenFeature.setContext(clientProviderFactoryOptions.initConfiguration.context).then(() => {
        OpenFeature.setProvider(clientProvider);
      });
    }
  }, [isServer, clientProvider, clientProviderFactoryOptions.initConfiguration.context]);

  if (isServer) {
    const ssrClient = new OpenFeatureClient(
      () => clientProvider,
      () => new OpenFeatureEventEmitter(),
      () => new DefaultLogger(),
      {},
    );

    return (
      <OpenFeatureContextProvider client={ssrClient} providerReady>
        <React.Suspense fallback={fallback}>{children}</React.Suspense>
      </OpenFeatureContextProvider>
    );
  }

  return (
    <OpenFeatureContextProvider providerReady>
      <React.Suspense fallback={fallback}>{children}</React.Suspense>
    </OpenFeatureContextProvider>
  );
}
