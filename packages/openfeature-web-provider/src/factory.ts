import { Provider } from '@openfeature/web-sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { ConfidenceClient } from '@spotify-confidence/client-http';

type ConfidenceWebProviderFactoryOptions = {
  region: 'eu' | 'us';
  fetchImplementation: typeof fetch;
  clientSecret: string;
  baseUrl?: string;
  apply?: {
    timeout: number;
  };
};

export function createConfidenceWebProvider(options: ConfidenceWebProviderFactoryOptions): Provider {
  const confidenceClient = new ConfidenceClient({
    ...options,
    apply: !options.apply,
  });

  return new ConfidenceWebProvider(confidenceClient, {
    apply: options.apply,
  });
}
