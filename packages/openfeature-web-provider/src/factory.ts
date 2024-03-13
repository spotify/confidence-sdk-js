import { Provider } from '@openfeature/web-sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { Confidence } from '@spotify-confidence/sdk';

export function createConfidenceWebProvider(confidence: Confidence): Provider {
  return new ConfidenceWebProvider(confidence);
}
