import { Confidence } from '@spotify-confidence/sdk';
import { cache } from 'react';

export const isServer = typeof window === 'undefined';

const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  environment: isServer ? 'backend' : 'client',
  timeout: 1000,
  logger: console,
});

export function getConfidence() {
  const targeting_key = 'test-a';
  return confidence.withContext({ targeting_key });
}

export const getNumber = cache(() => Math.random());
