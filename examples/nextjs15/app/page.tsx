import React, { cache, FC, ReactNode, Suspense, use } from 'react';
import { ClientComponent } from './ClientComponent';
import { ConfidenceProvider, getCache } from './confidence/server';
import { ServerComponent } from './ServerComponent';
import { Confidence, Context } from './confidence';
import { useConfidence } from './confidence/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

// const confidence = new Confidence();
const db = new Map<string, string>();

db.set('andreas', 'admin');

const confidence = Confidence.create({ clientSecret: 'xyz' });

export default function Page() {
  console.log('Page render');
  const userId = 'andreas';
  return (
    <>
      <ConfidenceProvider value={confidence.withContext({ userId, role: db.get(userId) })}>
        <ServerComponent />
        <Suspense fallback="Loading...">
          <ClientComponent setRole={setRole.bind(null, userId)} />
        </Suspense>
        {/* <Test /> */}
      </ConfidenceProvider>
      {/* <Test /> */}
    </>
  );
}

const Test: FC<{ children?: ReactNode }> = ({ children }) => {
  // debugger;
  console.log('Test render', useConfidence());
  return (
    <fieldset>
      <legend>Test</legend>
      {children}
    </fieldset>
  );
};

async function setRole(userId: string, role: string) {
  'use server';
  db.set(userId, role);
  revalidatePath('/');
}
