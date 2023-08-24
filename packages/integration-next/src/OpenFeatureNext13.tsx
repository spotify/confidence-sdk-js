'use client';
import React from 'react';
import { EvaluationContext, OpenFeature, ProviderStatus } from '@openfeature/web-sdk';
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { Configuration } from '@spotify-confidence/client-http';

export namespace OpenFeatureNext13 {
  export interface ClientSetupProps {
    serializedConfig: Configuration.Serialized;
    context: EvaluationContext;
    clientProvider: ReturnType<typeof createConfidenceWebProvider>;
  }
  export function ClientSetup(props: ClientSetupProps) {
    const { serializedConfig, context, clientProvider } = props;

    if (clientProvider.status !== ProviderStatus.READY) {
      clientProvider.initConfig(serializedConfig, context);
      OpenFeature.setContext(context).then(() => {
        OpenFeature.setProvider(clientProvider);
      });
    }

    return <></>;
  }
}
