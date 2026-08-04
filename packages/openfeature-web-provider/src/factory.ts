import { Provider } from '@openfeature/web-sdk';
import { ConfidenceClient } from '@spotify-confidence/sdk';
import type { Logger } from '@spotify-confidence/sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';

const SDK_VERSION = '0.3.22'; // x-release-please-version

/**
 * Factory Options for Confidence Web Provider
 * @public */
export type ConfidenceWebProviderOptions = {
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
  /**
   * Milliseconds to batch exposure over: flags evaluated within the window are
   * applied in one request. 0 applies each flag as it is evaluated.
   *
   * Defaults to 10.
   */
  applyDebounce?: number;
  /** Reports resolve and apply failures. Defaults to the console in development */
  logger?: Logger;
};

/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param options - Options for Confidence Provider
 * @public */
export function createConfidenceWebProvider(options: ConfidenceWebProviderOptions): Provider {
  const client = new ConfidenceClient({
    flagClientSecret: options.clientSecret,
    url: resolverUrl(options),
    fetch: options.fetchImplementation,
    logger: options.logger ?? defaultLogger(),
    sdk: { name: 'JS_WEB_PROVIDER', version: SDK_VERSION },
  });
  return new ConfidenceWebProvider(client, {
    timeout: options.timeout,
    applyDebounce: options.applyDebounce,
  });
}

/** Undefined leaves the client on its default, the global resolver */
function resolverUrl({ region, resolveBaseUrl }: ConfidenceWebProviderOptions): string | undefined {
  if (resolveBaseUrl) return resolveBaseUrl;
  return region && `https://resolver.${region}.confidence.dev`;
}

/**
 * Matches the Confidence SDK: silent in production, but loud enough to debug a
 * failing resolve in development. `process` is absent in some browser bundles.
 */
function defaultLogger(): Logger | undefined {
  try {
    if (process.env.NODE_ENV === 'development') return console;
  } catch (e) {
    // ignore
  }
  return undefined;
}
