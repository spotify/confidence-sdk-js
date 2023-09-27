import React from 'react';
import { OpenFeature } from '@openfeature/js-sdk';
import { ClientSetup } from '@spotify-confidence/integration-next/ClientSetup';
import { useStringValue } from '@spotify-confidence/integration-next';
import { serverProvider } from '../../utils/server-provider';

function TestComponent() {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');
  return <p>{str}</p>;
}

export default function Old(props: any) {
  const { initConfiguration } = props;

  return (
    <>
      <ClientSetup
        clientProviderFactoryOptions={{
          clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
          initConfiguration,
          region: 'eu',
          fetchImplementation: fetch.bind(this) || window.fetch.bind(window),
          apply: {
            timeout: 1000,
          },
        }}
      />
      <TestComponent />
    </>
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
