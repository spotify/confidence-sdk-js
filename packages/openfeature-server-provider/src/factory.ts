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
  /** Milliseconds to wait for a resolve. Past it, flags evaluate to their defaults */
  timeout: number;
  /** Sets the resolver region. Defaults to the global region */
  region?: 'eu' | 'us';
  /** Sets an alternative resolve url */
  resolveBaseUrl?: string;
  /** fetch-compatible transport. Defaults to the global fetch */
  fetchImplementation?: typeof fetch;
  /** Reports resolve failures. Defaults to the console in development */
  logger?: Logger;
};

/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param options - Options for Confidence Provider
 * @public */
export function createConfidenceServerProvider(options: ConfidenceProviderFactoryOptions): Provider {
  const client = new ConfidenceClient({
    flagClientSecret: options.clientSecret,
    url: resolverUrl(options),
    fetch: options.fetchImplementation,
    logger: options.logger ?? defaultLogger(),
    sdk: { name: 'JS_SERVER_PROVIDER', version: SDK_VERSION },
  });
  return new ConfidenceServerProvider(client, { timeout: options.timeout });
}

/** Undefined leaves the client on its default, the global resolver */
function resolverUrl({ region, resolveBaseUrl }: ConfidenceProviderFactoryOptions): string | undefined {
  if (resolveBaseUrl) return resolveBaseUrl;
  return region && `https://resolver.${region}.confidence.dev`;
}

/**
 * Matches the Confidence SDK: silent in production, but loud enough to debug a
 * failing resolve in development.
 */
function defaultLogger(): Logger | undefined {
  try {
    if (process.env.NODE_ENV === 'development') return console;
  } catch (e) {
    // ignore
  }
  return undefined;
}
