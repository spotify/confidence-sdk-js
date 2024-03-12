import { Provider } from '@openfeature/server-sdk';
import { ConfidenceServerProvider } from './ConfidenceServerProvider';
import { Confidence } from '@spotify-confidence/sdk';

export function createConfidenceServerProvider(confidence: Confidence): Provider {
  return new ConfidenceServerProvider(confidence);
}
