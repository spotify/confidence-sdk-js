import { Provider } from '@openfeature/server-sdk';
import { ConfidenceClient } from '@spotify-confidence/sdk';
import type { Logger } from '@spotify-confidence/sdk';
import { ConfidenceServerProvider } from './ConfidenceServerProvider';

const SDK_VERSION = '0.3.22'; // x-release-please-version

/**
 * Factory Options for Confidence Server Provider
 * @public */
export type ConfidenceProviderFactoryOptions = {
  /** Credentials identifying the client and the flags available to it */
  clientSecret: string;
  /** Deadline in milliseconds for each resolve or event request */
  timeout: number;
  /** Pins flag resolution and event publishing to a region. Defaults to the global region */
  region?: 'eu' | 'us';
  /** fetch-compatible transport. Defaults to the global fetch */
  fetchImplementation?: typeof fetch;
  /** Reports resolve and event failures. Defaults to the console in development */
  logger?: Logger;
};

/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param options - Options for Confidence Provider
 * @public */
export function createConfidenceServerProvider(options: ConfidenceProviderFactoryOptions): Provider {
  const client = new ConfidenceClient({
    clientSecret: options.clientSecret,
    region: options.region,
    fetch: options.fetchImplementation,
    logger: options.logger ?? defaultLogger(),
    sdk: { name: 'JS_SERVER_PROVIDER', version: SDK_VERSION },
  });
  return new ConfidenceServerProvider(client, { timeout: options.timeout });
}

/**
 * Silent in production; reports failures in development.
 */
function defaultLogger(): Logger | undefined {
  try {
    if (process.env.NODE_ENV === 'development') return console;
  } catch (e) {
    // ignore
  }
  return undefined;
}
