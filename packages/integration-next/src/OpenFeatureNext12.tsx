import React from 'react';
import { EvaluationContext, OpenFeature, ProviderStatus } from '@openfeature/web-sdk';
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { Configuration } from '@spotify-confidence/client-http';

export namespace OpenFeatureNext12 {
  export interface ClientSetupProps {
    serializedConfig: Configuration.Serialized;
    context: EvaluationContext;
    clientProvider: ReturnType<typeof createConfidenceWebProvider>;
    fallback: React.ReactNode;
  }

  export function ClientSetup(props: React.PropsWithChildren<ClientSetupProps>) {
    const { serializedConfig, context, clientProvider, fallback, children } = props;

    if (clientProvider.status !== ProviderStatus.READY) {
      clientProvider.initConfig(serializedConfig, context);
      OpenFeature.setContext(context).then(() => {
        OpenFeature.setProvider(clientProvider);
      });
    }

    return <React.Suspense fallback={fallback}>{children}</React.Suspense>;
  }
}
