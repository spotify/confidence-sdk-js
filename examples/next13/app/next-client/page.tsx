import React from 'react';
import { createConfidenceServerProvider } from '@spotify-confidence/openfeature-server-provider';
import { OpenFeatureNext13 } from '@spotify-confidence/integration-next';
import { clientProvider } from './client-provider';
import { ClientComponent } from './client-component';
import { OpenFeature } from '@openfeature/js-sdk';

const serverProvider = createConfidenceServerProvider({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  region: 'eu',
  fetchImplementation: fetch.bind(this),
  apply: {
    timeout: 1000,
  },
});

OpenFeature.setProvider(serverProvider);

// const env = typeof window === 'undefined' ?
export default async function App() {
  const str = await OpenFeature.getClient().getStringValue('web-sdk-e2e-flag.str', 'defualt', {
    targetingKey: 'user-a',
  });
  return (
    <>
      <OpenFeatureNext13.ClientSetup
        serializedConfig={serverProvider.serialize()!}
        context={{
          targetingKey: 'user-a',
        }}
        clientProvider={clientProvider}
      />
      <React.Suspense fallback={<p>loading </p>}>
        <p>I'm server {str}</p>
        <ClientComponent />
      </React.Suspense>
    </>
  );
}
