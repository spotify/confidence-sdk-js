import { Provider } from '@openfeature/web-sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { Confidence } from '@spotify-confidence/sdk';

/**
 * Factory Options for Confidence Web Provider
 * @public */
export type ConfidenceWebProviderOptions = {
  region?: 'eu' | 'us';
  fetchImplementation?: typeof fetch;
  clientSecret: string;
  timeout: number;
};

/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param options - Options for Confidence Provider
 * @public */
export function createConfidenceWebProvider(options: ConfidenceWebProviderOptions): Provider;
/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param confidence - Confidence instance
 * @public */
export function createConfidenceWebProvider(confidence: Confidence): Provider;
/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param confidenceOrOptions - Confidence instance or options for Confidence Provider
 * @public */
export function createConfidenceWebProvider(confidenceOrOptions: Confidence | ConfidenceWebProviderOptions): Provider {
  if (confidenceOrOptions instanceof Confidence) {
    return new ConfidenceWebProvider(confidenceOrOptions);
  }
  const confidence = Confidence.create({
    ...confidenceOrOptions,
    environment: 'client',
  });
  return new ConfidenceWebProvider(confidence);
}
