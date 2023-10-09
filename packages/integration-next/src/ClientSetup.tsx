'use client';
import React, { useMemo } from 'react';
import { EvaluationDetails, Features, JsonValue, Logger, OpenFeature } from '@openfeature/web-sdk';
import { ConfidenceWebProvider, createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { FeatureStoreContext, OpenFeatureContextProvider } from '@spotify-confidence/integration-react';

const noopLogger: Logger = {
  error: () => {},
  info: () => {},
  warn: () => {},
  debug: () => {},
};

type RequiredSelected<T, K extends keyof T> = {
  [P in K]-?: NonNullable<T[P]>;
} & T;

export interface ClientSetupProps {
  clientProviderFactoryOptions: RequiredSelected<
    Parameters<typeof createConfidenceWebProvider>[0],
    'initConfiguration'
  >;
  isServer?: boolean;
  clientName?: string;
  fallback: React.ReactNode;
}

export function ClientSetup(props: React.PropsWithChildren<ClientSetupProps>) {
  const {
    clientProviderFactoryOptions,
    isServer = typeof window === 'undefined',
    children,
    fallback,
    clientName,
  } = props;

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
    const store = {
      subscribe: () => {
        throw new Error('Subscription not supported in SSR');
      },
      getSnapshot: () => new SSRFeatures(clientProvider),
    };
    return (
      <FeatureStoreContext.Provider value={store}>
        <React.Suspense fallback={fallback}>{children}</React.Suspense>
      </FeatureStoreContext.Provider>
    );
  }

  return (
    <OpenFeatureContextProvider client={OpenFeature.getClient(clientName)}>
      <React.Suspense fallback={fallback}>{children}</React.Suspense>
    </OpenFeatureContextProvider>
  );
}

class SSRFeatures implements Features {
  constructor(private provider: ConfidenceWebProvider) {}

  getBooleanValue(flagKey: string, defaultValue: boolean): boolean {
    return this.provider.resolveBooleanEvaluation(
      flagKey,
      defaultValue,
      this.provider.configuration?.context!,
      noopLogger,
    ).value;
  }
  getBooleanDetails(flagKey: string, defaultValue: boolean): EvaluationDetails<boolean> {
    return {
      flagKey,
      flagMetadata: {},
      ...this.provider.resolveBooleanEvaluation(
        flagKey,
        defaultValue,
        this.provider.configuration?.context!,
        noopLogger,
      ),
    };
  }
  getStringValue(flagKey: string, defaultValue: string): string {
    return this.provider.resolveStringEvaluation(
      flagKey,
      defaultValue,
      this.provider.configuration?.context!,
      noopLogger,
    ).value;
  }
  getStringDetails(flagKey: string, defaultValue: string): EvaluationDetails<string> {
    return {
      flagKey,
      flagMetadata: {},
      ...this.provider.resolveStringEvaluation(
        flagKey,
        defaultValue,
        this.provider.configuration?.context!,
        noopLogger,
      ),
    };
  }
  getNumberValue(flagKey: string, defaultValue: number): number {
    return this.provider.resolveNumberEvaluation(
      flagKey,
      defaultValue,
      this.provider.configuration?.context!,
      noopLogger,
    ).value;
  }
  getNumberDetails(flagKey: string, defaultValue: number): EvaluationDetails<number> {
    return {
      flagKey,
      flagMetadata: {},
      ...this.provider.resolveNumberEvaluation(
        flagKey,
        defaultValue,
        this.provider.configuration?.context!,
        noopLogger,
      ),
    };
  }
  getObjectValue(flagKey: string, defaultValue: JsonValue): JsonValue {
    return this.provider.resolveObjectEvaluation(
      flagKey,
      defaultValue,
      this.provider.configuration?.context!,
      noopLogger,
    ).value;
  }
  getObjectDetails(flagKey: string, defaultValue: JsonValue): EvaluationDetails<JsonValue> {
    return {
      flagKey,
      flagMetadata: {},
      ...this.provider.resolveObjectEvaluation(
        flagKey,
        defaultValue,
        this.provider.configuration?.context!,
        noopLogger,
      ),
    };
  }
}
