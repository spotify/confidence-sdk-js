import { Provider } from '@openfeature/js-sdk';

import { ConfidenceClient } from '@spotify-confidence/client-http';

import { ConfidenceServerProvider } from './ConfidenceServerProvider';

type ConfidenceProviderFactoryOptions = {
  region: 'eu' | 'us';
  fetchImplementation: typeof fetch;
  clientSecret: string;
  baseUrl?: string;
  timeout: number;
};

export function createConfidenceServerProvider(options: ConfidenceProviderFactoryOptions): Provider {
  const confidenceClient = new ConfidenceClient({
    ...options,
    apply: true,
  });

  return new ConfidenceServerProvider(confidenceClient);
}
