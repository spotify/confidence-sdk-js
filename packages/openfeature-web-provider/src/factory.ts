import { Provider } from '@openfeature/web-sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { ConfidenceClient, ConfidenceClientOptions } from '@spotify-confidence/client-http';

type ConfidenceWebProviderFactoryOptions = {
  region?: ConfidenceClientOptions['region'];
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
      version: '0.2.0', // x-release-please-version
    },
  });

  return new ConfidenceWebProvider(confidenceClient, {
    apply: options.apply || 'access',
  });
}
