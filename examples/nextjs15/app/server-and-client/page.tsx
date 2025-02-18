import { Confidence } from '@/confidence/confidence';
import { ConfidenceProvider, useConfidence } from '@/confidence/server';
import { Suspense } from 'react';
import { ServerComponent } from '@/components/ServerComponent';
import { cookies } from 'next/headers';
import { CookieControls } from '@/components/CookieControls';
import { ClientComponent } from '@/components/ClientComponent';

const confidence = Confidence.create({ clientSecret: 'xyz' });

export default async function Page() {
  const cookieStore = await cookies();
  let visitorId = cookieStore.get('visitor.id')?.value ?? 'unknown';

  return (
    <div>
      <ConfidenceProvider value={confidence.withContext({ visitorId })} mode="isomorphic">
        <ClientComponent name={visitorId}>
          <ServerComponent>
            <ClientComponent name={visitorId}></ClientComponent>
          </ServerComponent>
        </ClientComponent>
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
