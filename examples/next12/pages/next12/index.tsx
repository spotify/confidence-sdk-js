import React from 'react';
import { OpenFeature } from '@openfeature/js-sdk';
import { setupOpenFeatureConfidenceProvider } from '../../utils/setupOpenFeatureConfidenceProvider';

setupOpenFeatureConfidenceProvider();

interface Next12StyleComponentProps {
  string: string;
}
export default function Next12StyleComponent(props: React.PropsWithChildren<Next12StyleComponentProps>) {
  return <p>Value for the string from getServerSideProps: {props.string}</p>;
}

export async function getServerSideProps() {
  const boolToUseOnServerSide = await OpenFeature.getClient().getBooleanValue('web-sdk-e2e-flag.bool', true, {
    targetingKey: 'user-a',
  });

  if (boolToUseOnServerSide) {
    // eslint-disable-next-line no-console
    console.log('Do something with experimentation on the server side!');
  }

  const stringValueForClient = await OpenFeature.getClient().getStringValue('web-sdk-e2e-flag.str', 'default', {
    targetingKey: 'user-a',
  });

  return { props: { string: stringValueForClient } };
}
