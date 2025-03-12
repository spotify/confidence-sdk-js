import { ServerComponent } from '@/components/ServerComponent';
import { cookies } from 'next/headers';
import { CookieControls } from '@/components/CookieControls';
import { ClientComponent } from '@/components/ClientComponent';
// import { ConfidenceProvider } from '@spotify-confidence/react/server';
import { getNumber } from 'flags-client';
import { getConfidence } from 'flags';
import { ManagedConfidenceProvider } from '@spotify-confidence/react';
import { Suspense } from 'react';

export default async function Page() {
  const cookieStore = await cookies();
  let visitorId = cookieStore.get('visitor.id')?.value ?? 'unknown';
  const confidence = getConfidence({ targeting_key: visitorId });
  console.log('details', await confidence.evaluateFlag('web-sdk-e2e-flag.str', 'red'));
  return (
    <div>
      <pre>{getNumber()}</pre>
      <ManagedConfidenceProvider options={await confidence.toOptions()}>
        <Suspense fallback={<fieldset>Loading...</fieldset>}>
          <ClientComponent name={visitorId}>
            <ServerComponent>
              <ClientComponent name={visitorId}></ClientComponent>
            </ServerComponent>
          </ClientComponent>
        </Suspense>
      </ManagedConfidenceProvider>
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
