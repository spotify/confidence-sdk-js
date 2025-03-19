import { Confidence } from '@spotify-confidence/sdk';
import React, { ReactNode } from 'react';
import { ManagedConfidenceProvider } from '@spotify-confidence/react/client';
import 'server-only';

export async function ConfidenceProvider(props: { confidence: Confidence; children?: ReactNode }) {
  const controller = new AbortController();
  const options = props.confidence.toOptions(controller.signal);
  return (
    <ManagedConfidenceProvider options={options}>
      {props.children}
      <Trailer controller={controller} />
    </ManagedConfidenceProvider>
  );
}

function Trailer(props: { controller: AbortController }) {
  props.controller.abort();
  return undefined;
}
