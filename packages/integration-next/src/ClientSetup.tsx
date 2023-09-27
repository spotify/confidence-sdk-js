'use client';
import React, { useMemo } from 'react';
import { OpenFeature } from '@openfeature/web-sdk';
import { ConfidenceWebProvider, createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';

type RequiredSelected<T, K extends keyof T> = {
  [P in K]-?: NonNullable<T[P]>;
} & T;

export interface ClientSetupProps {
  clientProviderFactoryOptions: RequiredSelected<
    Parameters<typeof createConfidenceWebProvider>[0],
    'initConfiguration'
  >;
  isServer?: boolean;
}
export function ClientSetup(props: ClientSetupProps) {
  const { clientProviderFactoryOptions, isServer = typeof window === 'undefined' } = props;

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
    OpenFeature.setContext(clientProviderFactoryOptions.initConfiguration.context).then(() => {
      OpenFeature.setProvider(clientProvider);
    });
  }, [clientProvider, clientProviderFactoryOptions.initConfiguration.context]);

  return <></>;
}
