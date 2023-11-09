import { Provider } from '@openfeature/web-sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { ConfidenceClient } from '@spotify-confidence/client-http';

type ConfidenceWebProviderFactoryOptions = {
  region: 'eu' | 'us';
  fetchImplementation: typeof fetch;
  clientSecret: string;
  baseUrl?: string;
  apply?: 'access' | 'backend';
  timeout: number;
};

export function createConfidenceWebProvider(options: ConfidenceWebProviderFactoryOptions): Provider {
  const confidenceClient = new ConfidenceClient({
    ...options,
    apply: options.apply === 'backend',
    sdk: {
      id: 'SDK_ID_JS_WEB_PROVIDER',
      version: '0.0.0', // x-release-please-version
    },
  });

  return new ConfidenceWebProvider(confidenceClient, {
    apply: options.apply || 'access',
  });
}
