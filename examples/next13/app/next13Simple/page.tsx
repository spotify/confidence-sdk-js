import React from 'react';
import { SimpleClientComponent } from './SimpleClientComponent';
import { OpenFeature } from '@openfeature/js-sdk';
import { setupOpenFeatureConfidenceProvider } from '@/utils/setupOpenFeatureConfidenceProvider';

setupOpenFeatureConfidenceProvider();

export default async function App() {
  const str = await OpenFeature.getClient().getStringValue('web-sdk-e2e-flag.str', 'default', {
    targetingKey: 'user-a',
  });

  return (
    <>
      <p>Flag value being used in the Server Component: {str}</p>
      <SimpleClientComponent string={str} />
    </>
  );
}
