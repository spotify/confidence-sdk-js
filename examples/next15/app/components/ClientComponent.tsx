'use client';

import React, { FC, ReactNode } from 'react';
import { useConfidence, useFlag } from '@spotify-confidence/react/client';
import { getNumber, isServer } from 'flags-client';

export const ClientComponent: FC<{ name: string; children?: ReactNode; setRole?: (role: string) => void }> = ({
  name,
  children,
}) => {
  console.log('ClientComponent render', isServer ? 'server' : 'client', Date.now() / 1000);
  const confidence = useConfidence();
  const color = useFlag('web-sdk-e2e-flag.str', 'red');
  const vistorId = confidence.getContext().targeting_key ?? 'unknown';
  return (
    <fieldset>
      <legend>ClientComponent</legend>
      <h1 style={{ color }}>
        Hello {vistorId} {color}
      </h1>
      <button onClick={() => confidence.setContext({ targeting_key: 'andreas' })}>
        Set context visitorId to andreas
      </button>
      {children}
    </fieldset>
  );
};
