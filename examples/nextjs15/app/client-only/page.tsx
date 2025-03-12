'use client';
import { Suspense } from 'react';
import { CookieControls } from '@/components/CookieControls';
import { ClientComponent } from '@/components/ClientComponent';
// import { getConfidence } from 'flags-client';
import { ConfidenceProvider, ManagedConfidenceProvider } from '@spotify-confidence/react';
import { Confidence } from '@spotify-confidence/sdk';

const isServer = typeof window === 'undefined';

const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  environment: isServer ? 'backend' : 'client',
  timeout: 10000,
  fetchImplementation: async req => {
    console.log('fetching', isServer ? 'server' : 'client');
    // if (isServer) throw new Error('Cannot fetch on server');
    await sleep(isServer ? 10000 : 1000);
    return fetch(req);
  },
  logger: console,
});

export default function Page() {
  console.log('render Page', isServer ? 'server' : 'client', Date.now() / 1000);
  // const confidence = getConfidence();
  const myConfidence = confidence.withContext({ targeting_key: 'test-b' });
  let visitorId = myConfidence.getContext().targeting_key!;
  return (
    <div>
      <ConfidenceProvider confidence={myConfidence}>
        <Suspense fallback={<fieldset>Loading...</fieldset>}>
          <ClientComponent name={visitorId}>{/* <ClientComponent name={visitorId} /> */}</ClientComponent>
        </Suspense>
      </ConfidenceProvider>

      <CookieControls />
      <h2>Pros</h2>
      <ul>
        <li>Minimal SDK code in bundle, resolves are proxied through server</li>
      </ul>
      <h2>Cons</h2>
      <ul>
        <li>Flags can't be resolved in server components</li>
      </ul>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
