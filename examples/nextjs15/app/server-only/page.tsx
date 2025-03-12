import { Suspense } from 'react';
import { ServerComponent } from '@/components/ServerComponent';
import { CookieControls } from '@/components/CookieControls';
import { after } from 'next/server';

export default async function Page() {
  after(() => {
    console.log('Page after');
  });
  return (
    <div>
      <Suspense fallback={<fieldset>Loading...</fieldset>}>
        <ServerComponent>
          <ServerComponent />
        </ServerComponent>
      </Suspense>
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
