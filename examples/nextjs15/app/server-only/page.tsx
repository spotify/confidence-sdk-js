import { Confidence } from '@/confidence/confidence';
import { ConfidenceProvider, useConfidence } from '@/confidence/server';
import { Suspense } from 'react';
import { ServerComponent } from '@/components/ServerComponent';
import { cookies } from 'next/headers';
import { CookieControls } from '@/components/CookieControls';

const confidence = Confidence.create({ clientSecret: 'xyz' });

export default async function Page() {
  const cookieStore = await cookies();
  let visitorId = cookieStore.get('visitor.id')?.value;

  return (
    <div>
      <ConfidenceProvider value={confidence.withContext({ visitorId })} mode="server">
        <Suspense fallback={<fieldset>Loading...</fieldset>}>
          <ServerComponent>
            <ServerComponent />
          </ServerComponent>
        </Suspense>
      </ConfidenceProvider>
      <CookieControls />
      <h2>Pros</h2>
      <ul>
        <li>No confidence SDK code in the bundle</li>
      </ul>
      <h2>Cons</h2>
      <ul>
        <li>Flags can't be resolved in client components, but need to be passed as props</li>
      </ul>
    </div>
  );
}
