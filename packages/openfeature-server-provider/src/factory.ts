import { Provider } from '@openfeature/js-sdk';

import { ConfidenceClient } from '@spotify-confidence/client-http';

import { ConfidenceServerProvider } from './ConfidenceServerProvider';

type ConfidenceProviderFactoryOptions = {
  region: 'eu' | 'us';
  fetchImplementation: typeof fetch;
  clientSecret: string;
  baseUrl?: string;
  apply?: {
    timeout: number;
  };
};

export function createConfidenceServerProvider(options: ConfidenceProviderFactoryOptions): Provider {
  const confidenceClient = new ConfidenceClient({
    ...options,
    apply: !options.apply,
  });

  return new ConfidenceServerProvider(confidenceClient, {
    apply: options.apply,
  });
}
