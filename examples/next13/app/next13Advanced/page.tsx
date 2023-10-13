import React from 'react';
import { OpenFeature } from '@openfeature/js-sdk';

import { ClientComponent } from '@/app/next13Advanced/ClientComponent';
import { setupOpenFeatureConfidenceProvider } from '@/utils/setupOpenFeatureConfidenceProvider';
import { ClientBoundary } from '@/utils/ClientBoundary';

import { SetOpenFeatureContext } from './setOpenFeatureContext';

setupOpenFeatureConfidenceProvider();

export default async function App() {
  const str = await OpenFeature.getClient().getStringValue('web-sdk-e2e-flag.str', 'default', {
    targetingKey: 'user-a',
  });

  return (
    <>
      {/* @ts-expect-error Server Component */}
      <ClientBoundary>
        <SetOpenFeatureContext context={{ targetingKey: 'user-a' }} />
      </ClientBoundary>

      <p>Flag value being used in the Server Component: {str}</p>

      {/* @ts-expect-error Server Component */}
      <ClientBoundary>
        <React.Suspense fallback={<p>loading...</p>}>
          <ClientComponent />
        </React.Suspense>
      </ClientBoundary>
    </>
  );
}
