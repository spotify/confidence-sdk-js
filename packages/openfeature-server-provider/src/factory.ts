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
    sdk: {
      id: 'SDK_ID_JS_SERVER_PROVIDER',
      version: '0.1.2', // x-release-please-version
    },
  });

  return new ConfidenceServerProvider(confidenceClient);
}
