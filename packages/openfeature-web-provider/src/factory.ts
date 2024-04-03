import { Provider } from '@openfeature/web-sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { Confidence } from '@spotify-confidence/sdk';

type ConfidenceWebProviderFactoryOptions = {
  region?: 'global' | 'eu' | 'us';
  fetchImplementation?: typeof fetch;
  clientSecret: string;
  baseUrl?: string;
  apply?: 'access' | 'backend';
  timeout: number;
};

export function createConfidenceWebProvider(options: ConfidenceWebProviderFactoryOptions): Provider;
export function createConfidenceWebProvider(confidence: Confidence): Provider;
export function createConfidenceWebProvider(
  confidenceOrOptions: Confidence | ConfidenceWebProviderFactoryOptions,
): Provider {
  if (confidenceOrOptions instanceof Confidence) {
    return new ConfidenceWebProvider(confidenceOrOptions);
  }
  const confidence = Confidence.create({
    ...confidenceOrOptions,
    environment: 'client',
  });
  return new ConfidenceWebProvider(confidence);
}
