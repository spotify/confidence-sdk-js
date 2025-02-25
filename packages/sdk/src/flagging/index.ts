import { Context } from '../context';
import { addExtension, Confidence, ConfigFactory } from '../core';
import { FlagResolution } from '../FlagResolution';
import { ResolveError } from '../FlagResolverClient';
import { ResolveFlagsRequest, ResolveFlagsResponse } from '../generated/confidence/flags/resolver/v1/api';
import { SdkId } from '../generated/confidence/flags/resolver/v1/types';
import { Value } from '../Value';

const FLAG_PREFIX = 'flags/';

interface FlaggingOptions {
  clientSecret: string;
  fetchImplementation?: typeof fetch;
}

interface FlaggingApi {
  getFlag<T extends Value>(key: string, defaultValue: T): Promise<T>;
}

interface FlaggingConfig {
  resolveFlags: (ctx: Context, names?: string[]) => Promise<FlagResolution>;
}

declare module '../core' {
  export interface ConfidenceOptions extends FlaggingOptions {}

  export interface Confidence extends FlaggingApi {}

  export interface Configuration extends FlaggingConfig {}
}

// TODO use the extension api stuff
Confidence.prototype.getFlag = function <T extends Value>(key: string, defaultValue: T): Promise<T> {
  return this.getContext()
    .then(ctx => this.config.resolveFlags(ctx))
    .then(flags => flags.evaluate(key, defaultValue).value);
};

const factory: ConfigFactory = ({ clientSecret, fetchImplementation = globalThis.fetch }) => {
  const sdk = {
    id: SdkId.SDK_ID_JS_CONFIDENCE,
    version: '0.2.2', // x-release-please-version
  } as const;

  // TODO should be an option
  const baseUrl = 'https://resolver.confidence.dev/v1';

  return {
    resolveFlags: (context, names = []) => {
      return fetchImplementation(`${baseUrl}/flags:resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          ResolveFlagsRequest.toJSON({
            clientSecret,
            evaluationContext: context,
            apply: false,
            flags: names.map(name => FLAG_PREFIX + name),
            sdk,
          }),
        ),
      })
        .then(resp => {
          if (!resp.ok) {
            throw new Error(`${resp.status}: ${resp.statusText}`);
          }
          return resp.json();
        })
        .then(ResolveFlagsResponse.fromJSON)
        .then(response => FlagResolution.ready(context, response))
        .catch(error => {
          if (error instanceof ResolveError) {
            return FlagResolution.failed(context, error.code, error.message);
          }
          return FlagResolution.failed(context, 'GENERAL', error.message);
        });
    },
  };
};

addExtension({ id: 'flagging', factory });
