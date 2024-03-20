import { Provider } from '@openfeature/server-sdk';
import { ConfidenceServerProvider } from './ConfidenceServerProvider';
import { Confidence } from '@spotify-confidence/sdk';

type ConfidenceProviderFactoryOptions = {
  region?: 'global' | 'eu' | 'us';
  fetchImplementation?: typeof fetch;
  clientSecret: string;
  baseUrl?: string;
  timeout: number;
};

export function createConfidenceServerProvider(options: ConfidenceProviderFactoryOptions): Provider;
export function createConfidenceServerProvider(confidence: Confidence): Provider;
export function createConfidenceServerProvider(
  confidenceOrOptions: Confidence | ConfidenceProviderFactoryOptions,
): Provider {
  if (confidenceOrOptions instanceof Confidence) {
    return new ConfidenceServerProvider(confidenceOrOptions);
  }
  const confidence = Confidence.create({
    ...confidenceOrOptions,
    environment: 'backend',
  });
  return new ConfidenceServerProvider(confidence);
}
