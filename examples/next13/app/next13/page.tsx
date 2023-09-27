import React from 'react';
import { ClientComponent } from './client-component';
import { OpenFeature } from '@openfeature/js-sdk';
import { ClientSetup } from '@spotify-confidence/integration-next/ClientSetup';
import { serverProvider } from '@/utils/server-provider';

OpenFeature.setProvider(serverProvider);

export default async function App() {
  const str = await OpenFeature.getClient().getStringValue('web-sdk-e2e-flag.str', 'default', {
    targetingKey: 'user-a',
  });

  return (
    <>
      <ClientSetup
        clientProviderFactoryOptions={{
          clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
          initConfiguration: await serverProvider.getConfiguration({ targetingKey: 'user-a' }),
          region: 'eu',
          apply: {
            timeout: 1000,
          },
        }}
      />
      <React.Suspense fallback={<p>loading...</p>}>
        <p>I am from the server: {str}</p>
        <ClientComponent />
      </React.Suspense>
    </>
  );
}
