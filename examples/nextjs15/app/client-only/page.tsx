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
      <ConfidenceProvider value={confidence.withContext({ visitorId })} mode="client">
        <Suspense fallback={<fieldset>Loading...</fieldset>}>
          <ClientComponent name={visitorId}>
            <ClientComponent name={visitorId} />
          </ClientComponent>
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
