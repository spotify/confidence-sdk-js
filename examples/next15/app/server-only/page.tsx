import React from 'react';
import { ServerComponent } from '@/components/ServerComponent';
import { CookieControls } from '@/components/CookieControls';
import { getConfidence } from 'flags';

const randomNumber = React.cache(() => Math.random());

export default async function Page() {
  const confidence = await getConfidence();
  console.log('details', await confidence.evaluateFlag('web-sdk-e2e-flag.str', 'red'));
  return (
    <div>
      <pre>{randomNumber()}</pre>
      <ServerComponent>
        <ServerComponent />
      </ServerComponent>
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
