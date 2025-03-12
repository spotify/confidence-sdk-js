import { Confidence, Context, Value } from '@spotify-confidence/sdk';
import { cookies } from 'next/headers';
import React from 'react';

const fetchImplementation = (req: Request) => {
  console.log('fetching', req.method, req.url);
  return fetch(req);
};
export const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  environment: 'backend',
  timeout: 1000,
  logger: console,
  fetchImplementation,
  cache: { scope: React.cache },
  applyDebounce: 301,
});

export const getConfidence = (context: Context): Confidence => {
  return confidence.withContext(context);
};
