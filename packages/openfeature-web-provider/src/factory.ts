import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { ConfidenceClient, Configuration } from '@spotify-confidence/client-http';

export type ConfidenceWebProviderFactoryOptions = {
  region: 'eu' | 'us';
  fetchImplementation?: typeof fetch;
  initConfiguration?: Configuration;
  clientSecret: string;
  baseUrl?: string;
  apply?: {
    timeout: number;
  };
};

export function createConfidenceWebProvider(options: ConfidenceWebProviderFactoryOptions): ConfidenceWebProvider {
  const { initConfiguration, ...otherOptions } = options;
  const confidenceClient = new ConfidenceClient({
    ...otherOptions,
    apply: !otherOptions.apply,
    fetchImplementation: getFetch(),
  });

  return new ConfidenceWebProvider(confidenceClient, {
    initConfiguration,
    apply: options.apply,
  });
}

function getFetch() {
  if (typeof window !== 'undefined') {
    return window.fetch.bind(window);
  }
  return global.fetch.bind(global);
}
