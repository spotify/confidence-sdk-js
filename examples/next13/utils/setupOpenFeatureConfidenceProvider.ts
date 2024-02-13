import { createConfidenceServerProvider } from '@spotify-confidence/openfeature-server-provider';
import { OpenFeature } from '@openfeature/server-sdk';

let setup: boolean = false;

export function setupOpenFeatureConfidenceProvider() {
  if (!setup) {
    OpenFeature.setProvider(
      createConfidenceServerProvider({
        clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
        region: 'eu',
        fetchImplementation: fetch.bind(global),
        timeout: 1000,
      }),
    );
    setup = true;
  }
}
