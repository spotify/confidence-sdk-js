'use client';

import React, { FC, ReactNode } from 'react';
import { useConfidence, useFlag } from '../confidence/client';

export const ClientComponent: FC<{ name: string; children?: ReactNode; setRole?: (role: string) => void }> = ({
  name,
  children,
}) => {
  console.log('ClientComponent render');
  const confidence = useConfidence();
  const color = useFlag('pantsColor', 'green');
  const vistorId = confidence.getContext().visitorId ?? 'unknown';

  return (
    <fieldset>
      <legend>ClientComponent</legend>
      <h1 style={{ color }}>Hello {vistorId}</h1>
      <button onClick={() => confidence.setContext({ visitorId: 'andreas' })}>Set context visitorId to andreas</button>
      {children}
    </fieldset>
  );
};
