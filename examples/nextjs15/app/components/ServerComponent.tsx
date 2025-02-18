import React, { FC, ReactNode, Suspense, use } from 'react';
import { useConfidence } from '@/confidence/server';
import { cookies } from 'next/headers';

export const ServerComponent: FC<{ children?: ReactNode }> = async ({ children }) => {
  console.log('ServerComponent render');
  const confidence = useConfidence();
  const pantsColor = await confidence.getFlag('pantsColor', 'green');

  return (
    <fieldset>
      <legend>ServerComponent</legend>
      <h1 style={{ color: pantsColor }}>Hello {getVisitorId()}</h1>
      {children}
    </fieldset>
  );
};

async function getVisitorId() {
  const cookieStore = await cookies();
  return cookieStore.get('visitor.id')?.value;
}
