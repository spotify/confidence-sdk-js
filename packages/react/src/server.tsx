import { Confidence } from '@spotify-confidence/sdk';
import React, { ReactNode } from 'react';
import { ManagedConfidenceProvider } from '@spotify-confidence/react';
import 'server-only';

export async function ConfidenceProvider(props: { confidence: Confidence; children?: ReactNode }) {
  let close: (() => void) | undefined;
  const options = props.confidence.toOptions();
  if (options.cache && options.cache.entries) {
    const entries = options.cache.entries;
    const keepOpen = new Promise<void>(resolve => {
      close = resolve;
    });
    options.cache.entries = {
      async *[Symbol.asyncIterator]() {
        await keepOpen;
        yield* entries;
      },
    };
  }
  const Trailer = () => {
    close?.();
    return null;
  };
  return (
    <ManagedConfidenceProvider options={options}>
      {props.children}
      <Trailer />
    </ManagedConfidenceProvider>
  );
}
