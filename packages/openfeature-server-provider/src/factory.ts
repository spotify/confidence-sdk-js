import { Provider } from '@openfeature/server-sdk';

import { ConfidenceClient, ConfidenceClientOptions } from '@spotify-confidence/client-http';

import { ConfidenceServerProvider } from './ConfidenceServerProvider';

type ConfidenceProviderFactoryOptions = {
  region?: ConfidenceClientOptions['region'];
  fetchImplementation?: typeof fetch;
  clientSecret: string;
  baseUrl?: string;
  timeout: number;
};

export function createConfidenceServerProvider({
  fetchImplementation = defaultFetchImplementation(),
  ...options
}: ConfidenceProviderFactoryOptions): Provider {
  const confidenceClient = new ConfidenceClient({
    ...options,
    fetchImplementation,
    apply: true,
    sdk: {
      id: 'SDK_ID_JS_SERVER_PROVIDER',
      version: '0.2.0', // x-release-please-version
    },
  });

  return new ConfidenceServerProvider(confidenceClient);
}

function defaultFetchImplementation(): typeof fetch {
  if (!globalThis.fetch) {
    throw new TypeError(
      'No default fetch implementation found. Please provide provide the fetchImplementation option to createConfidenceServerProvider.',
    );
  }
  return globalThis.fetch.bind(globalThis);
}
