import { Provider } from '@openfeature/server-sdk';
import { ConfidenceServerProvider } from './ConfidenceServerProvider';
import { Confidence, ConfidenceOptions } from '@spotify-confidence/sdk';

/**
 * Factory Options for Confidence Server Provider
 * @public */
export type ConfidenceProviderFactoryOptions = Omit<ConfidenceOptions, 'environment' | 'library' | 'context'>;

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
    // telemetry library tagging is not applied when passing a pre-built Confidence instance
    return new ConfidenceServerProvider(confidenceOrOptions);
  }
  const confidence = Confidence.create({
    ...confidenceOrOptions,
    environment: 'backend',
    library: 'openfeature',
  });
  return new ConfidenceServerProvider(confidence);
}
