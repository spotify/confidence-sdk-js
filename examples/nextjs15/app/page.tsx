import React, { Suspense } from 'react';
import { ClientComponent } from './ClientComponent';
import { ConfidenceProvider, getCache } from './confidence/server';
import { ServerComponent } from './ServerComponent';
import { Confidence } from './confidence';

export const dynamic = 'force-dynamic';

// const confidence = new Confidence();

// confidence.setContext({ userId: 'andreas' });

export default function Page() {
  const confidence = new Confidence({ cache: getCache(), context: { userId: 'andreas' } });
  return (
    <>
      <ConfidenceProvider value={confidence}>
        <Suspense fallback="Loading...">
          <ServerComponent />
          <ClientComponent />
        </Suspense>
      </ConfidenceProvider>
    </>
  );
}
