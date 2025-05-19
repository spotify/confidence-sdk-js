import { Provider } from '@openfeature/server-sdk';
import { ConfidenceServerProvider } from './ConfidenceServerProvider';
import { Confidence } from '@spotify-confidence/sdk';

/**
 * Factory Options for Confidence Server Provider
 * @public */
export type ConfidenceProviderFactoryOptions = {
  region?: 'eu' | 'us';
  fetchImplementation?: typeof fetch;
  clientSecret: string;
  timeout: number;
  /** Sets an alternative resolve url */
  resolveBaseUrl?: string;
};

/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param options - Options for Confidence Provider
 * @public */
export function createConfidenceServerProvider(options: ConfidenceProviderFactoryOptions): Provider;
/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param confidence - Confidence instance
 * @public */
export function createConfidenceServerProvider(confidence: Confidence): Provider;
/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param confidenceOrOptions - Confidence instance or options for Confidence Provider
 * @public */
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
