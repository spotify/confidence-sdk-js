'use client';
import { Suspense } from 'react';
import { CookieControls } from '@/components/CookieControls';
import { ClientComponent } from '@/components/ClientComponent';
// import { getConfidence } from 'flags-client';
import { ConfidenceProvider, ManagedConfidenceProvider } from '@spotify-confidence/react/client';
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
  console.log('do we have cookies?', typeof document !== 'undefined');
  const myConfidence = confidence.withContext({ targeting_key: getCookie('visitor.id') ?? 'unknown' });
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
      <h2>What's missing</h2>
      <ul>
        <li>
          It would be nice to be able to use context providers so that you could for instance read a browser cookie,
          cause we won't try to gather the context in SSR anyways.
        </li>
      </ul>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return;
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    const [key, value] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(value);
    }
  }
  return;
}
