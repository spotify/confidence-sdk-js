'use client';
import React, { Suspense } from 'react';
import { useStringValue } from '@spotify-confidence/integration-react';
import { OpenFeature } from '@openfeature/web-sdk';
export function ClientComponent() {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');

  return (
    <>
      <p>Value resolved from the client: {str}</p>
      <button onClick={() => OpenFeature.setContext({ targetingKey: `user-${Math.random()}` })}>
        Randomise OpenFeature Context
      </button>
    </>
  );
}
