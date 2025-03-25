import { Confidence, Context, Value } from '@spotify-confidence/sdk';
import { cookies } from 'next/headers';
import React from 'react';

const fetchImplementation = (req: Request) => {
  console.log('fetching', req.method, req.url);
  return fetch(req).then(res => {
    console.log('got response', res.status, res.statusText);
    return res;
  });
};
export const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  environment: 'backend',
  timeout: 1000000,
  logger: console,
  fetchImplementation,
  cache: { scope: React.cache },
  applyDebounce: 301,
});

export const getConfidence = (context: Context): Confidence => {
  return confidence.withContext(context);
};

type ConcentProvider = () => boolean | Promise<boolean>;
type FetchImpl = (request: Request) => Promise<Response>;
function applyIfConsented(consentProvider: ConcentProvider, fetchImpl: FetchImpl = fetch): FetchImpl {
  return async (request: Request) => {
    if (request.url.endsWith('/flags:apply')) {
      const hasConsent = await consentProvider();
      if (!hasConsent) {
        console.log('consent not given, apply blocked');
        return new Response(null, { status: 200 });
      }
    }
    return fetchImpl(request);
  };
}
