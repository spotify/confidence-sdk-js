'use client';
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { Provider } from '@openfeature/web-sdk';

export let provider: Provider | undefined;

if (typeof window !== 'undefined') {
  provider = createConfidenceWebProvider({
    clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    region: 'eu',
    fetchImplementation: fetch.bind(this) || window.fetch.bind(window),
    apply: {
      timeout: 1000,
    },
  });
}
