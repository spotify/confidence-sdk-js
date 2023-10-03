import React from 'react';
import { OpenFeature } from '@openfeature/js-sdk';
import { OpenFeature as OpenFeatureWeb } from '@openfeature/web-sdk';
import { ClientSetup } from '@spotify-confidence/integration-next/ClientSetup';
import { useStringValue } from '@spotify-confidence/integration-next';
import { serverProvider } from '@/utils/server-provider';

function TestComponent() {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');
  return (
    <>
      <p>{str}</p>;
      <button
        onClick={() => {
          OpenFeatureWeb.setContext({ targetingKey: 'user-a', random: Math.random() });
        }}
      >
        Random context
      </button>
    </>
  );
}

export default function Old(props: any) {
  const { initialConfiguration } = props;

  return (
    <>
      <ClientSetup
        clientProviderFactoryOptions={{
          clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
          initConfiguration: initialConfiguration,
          region: 'eu',
          apply: {
            timeout: 1000,
          },
        }}
      />
      <React.Suspense fallback={<p>Loading...</p>}>
        <TestComponent />
      </React.Suspense>
    </>
  );
}

export async function getServerSideProps() {
  OpenFeature.setProvider(serverProvider);

  const fromSSP = await OpenFeature.getClient().getBooleanValue('web-sdk-e2e-flag.str', true, {
    targetingKey: 'user-a',
  });

  return { props: { initialConfiguration: await serverProvider.getConfiguration({ targetingKey: 'user-a' }) } };
}
