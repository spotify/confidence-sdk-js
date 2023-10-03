import React from 'react';
import { OpenFeature } from '@openfeature/js-sdk';
import { OpenFeature as OpenFeatureWeb } from '@openfeature/web-sdk';
import { ClientSetup } from '@spotify-confidence/integration-next/ClientSetup';
import { useStringValue } from '@spotify-confidence/integration-next';
import { serverProvider } from '../../utils/server-provider';

function TestComponent() {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');
  return (
    <>
      <p>I am in the client {str}</p>
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
  const { initConfiguration } = props;

  return (
    <ClientSetup
      clientProviderFactoryOptions={{
        clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
        initConfiguration,
        region: 'eu',
        apply: {
          timeout: 1000,
        },
      }}
      fallback={<p>loading...</p>}
    >
      <TestComponent />
    </ClientSetup>
  );
}

export async function getServerSideProps() {
  OpenFeature.setProvider(serverProvider);

  const str = await OpenFeature.getClient().getStringValue('web-sdk-e2e-flag.str', 'default', {
    targetingKey: 'user-a',
  });

  // eslint-disable-next-line no-console
  console.log('Property in server side:', str);

  return {
    props: {
      initConfiguration: await serverProvider.getConfiguration({
        targetingKey: 'user-a',
      }),
    },
  };
}
