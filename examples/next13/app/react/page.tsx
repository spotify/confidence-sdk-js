'use client';
import { useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useRef } from 'react';
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { OpenFeature, OpenFeatureAPI } from '@openfeature/web-sdk';
import { useStringValue } from '@spotify-confidence/integration-react';

console.log('running global');

export const dynamic = 'force-dynamic';

const env = typeof window === 'undefined' ? 'server' : 'client';

export default function ReactExample() {
  // useSearchParams();
  useEffect(() => {
    const provider = createConfidenceWebProvider({
      clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
      region: 'eu',
      fetchImplementation: window.fetch.bind(window),
      apply: {
        timeout: 1000,
      },
    });

    OpenFeature.setContext({
      targetingKey: 'myTargetingKey',
    });
    OpenFeature.setProvider(provider);
  }, []);
  console.log('render in', env);
  return (
    <>
      <Suspense fallback={<Fallback />}>
        <Header />
      </Suspense>
    </>
  );
}

function Header() {
  console.log('render header in', env);
  try {
    // const value = useStringValue('web-sdk-e2e-flag.str', 'default');
    // const value = useValue();
    const value = 'hello';
    console.log('flag value', value);
    return <h1>{value}</h1>;
  } catch (e) {
    console.log('caught', e);
    throw e;
  }
}

function Fallback() {
  console.log('fallback in', env);
  return <p>{env} fallback</p>;
}

function useValue() {
  if (env === 'server') {
    throw new Error();
  }
  return 'wohoo!';
}
