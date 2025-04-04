import { ServerComponent } from '@/components/ServerComponent';
import { CookieControls } from '@/components/CookieControls';
import { ClientComponent } from '@/components/ClientComponent';
import { getNumber } from 'flags-client';
import { getConfidence } from 'flags';
import { ConfidenceProvider } from '@spotify-confidence/react/server';
import { Suspense } from 'react';

export default async function Page() {
  const confidence = await getConfidence();
  let visitorId = confidence.getContext().targeting_key!;
  // console.log('details', await confidence.evaluateFlag('web-sdk-e2e-flag.str', 'red'));
  return (
    <div>
      <pre>{getNumber()}</pre>
      <ConfidenceProvider confidence={confidence}>
        <Suspense fallback={<fieldset>Loading...</fieldset>}>
          <ClientComponent name={visitorId}>
            <ServerComponent>
              <ClientComponent name={visitorId}></ClientComponent>
            </ServerComponent>
          </ClientComponent>
        </Suspense>
      </ConfidenceProvider>
      <CookieControls />
      <h2>Pros</h2>
      <ul>
        <li>We can use the same isomorphic code in client and server</li>
      </ul>
      <h2>Cons</h2>
      <ul>
        <li>Unclear what it means to set the context from client!</li>
      </ul>
    </div>
  );
}
