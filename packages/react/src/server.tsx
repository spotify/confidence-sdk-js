import { Confidence } from '@spotify-confidence/sdk';
import React, { ReactNode } from 'react';
import { ManagedConfidenceProvider } from '@spotify-confidence/react/client';
import 'server-only';

export async function ConfidenceProvider(props: { confidence: Confidence; children?: ReactNode }) {
  let close: () => void;
  const keepOpen = new Promise<void>(resolve => {
    close = resolve;
  });
  const options = props.confidence.toOptions(keepOpen);
  const Trailer = () => {
    close();
    return null;
  };
  return (
    <ManagedConfidenceProvider options={options}>
      {props.children}
      <Trailer />
    </ManagedConfidenceProvider>
  );
}
