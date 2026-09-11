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
  /** Deadline in milliseconds for each resolve, exposure, or event request */
  timeout: number;
  /** Pins flag resolution and event publishing to a region. Defaults to the global region */
  region?: 'eu' | 'us';
  /** fetch-compatible transport. Defaults to the global fetch */
  fetchImplementation?: typeof fetch;
  /**
   * Milliseconds to batch exposure over: flags evaluated within the window are
   * applied in one request. 0 applies each flag as it is evaluated.
   *
   * Defaults to 10.
   */
  applyDebounce?: number;
  /** Reports resolve, exposure, and event failures. Defaults to the console in development */
  logger?: Logger;
};

/**
 * Creates an OpenFeature-adhering Confidence Provider
 * @param options - Options for Confidence Provider
 * @public */
export function createConfidenceWebProvider(options: ConfidenceWebProviderOptions): Provider {
  const client = new ConfidenceClient({
    clientSecret: options.clientSecret,
    region: options.region,
    fetch: options.fetchImplementation,
    logger: options.logger ?? defaultLogger(),
    sdk: { name: 'JS_WEB_PROVIDER', version: SDK_VERSION },
  });
  return new ConfidenceWebProvider(client, {
    timeout: options.timeout,
    applyDebounce: options.applyDebounce,
  });
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
