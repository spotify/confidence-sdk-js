import { Schema, TypeMismatchError, Value } from './Value';
import { Context } from './context';
import { FlagEvaluation, FlagResolution } from './flags';
import type {
  ResolveFlagsRequest,
  ResolveFlagsResponse,
  // ResolvedFlag,
} from './generated/confidence/flags/resolver/v1/api';
import { ResolveReason, Sdk } from './generated/confidence/flags/resolver/v1/types';
import { SimpleFetch } from './types';

type ResolvedFlags = Record<
  string,
  | undefined
  | {
      schema: Schema;
      value: Value.Struct;
      variant?: string;
      reason: '';
    }
>;
export class FlagResolutionImpl implements FlagResolution {
  constructor(private readonly flags: ResolvedFlags, readonly context: Value.Struct) {}

  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
    try {
      const [name, ...steps] = path.split('.');
      const flag = this.flags[name];
      if (!flag) {
        return {
          reason: 'ERROR',
          value: defaultValue,
          errorCode: 'FLAG_NOT_FOUND',
          errorMessage: `Flag "${name}" not found`,
        };
      }
      const value = Value.get(flag.value, ...steps) as T;
      const schema = flag.schema.get(...steps);

      schema.assertAssignsTo(defaultValue);

      const reason = toEvaluationReason(flag.reason);
      if (reason !== 'MATCH') {
        return {
          reason,
          value: defaultValue,
        };
      }
      return {
        reason,
        value,
        variant: flag.variant,
      };
    } catch (e: any) {
      return {
        reason: 'ERROR',
        value: defaultValue,
        errorCode: e instanceof TypeMismatchError ? 'TYPE_MISMATCH' : 'GENERAL',
        errorMessage: e.message ?? 'Unknown error',
      };
    }
  }
  getValue<T extends Value>(path: string, defaultValue: T): T {
    return this.evaluate(path, defaultValue).value;
  }
}

export type FlagResolverClientOptions = {
  fetchImplementation: SimpleFetch;
  clientSecret: string;
  sdk: Sdk;
};
export class FlagResolverClient {
  private readonly fetchImplementation: SimpleFetch;
  private readonly clientSecret: string;
  private readonly sdk: Sdk;

  constructor({ fetchImplementation, clientSecret, sdk }: FlagResolverClientOptions) {
    this.fetchImplementation = fetchImplementation;
    this.clientSecret = clientSecret;
    this.sdk = sdk;
  }

  async resolve(context: Context, flags: string[]): Promise<FlagResolution> {
    const request: ResolveFlagsRequest = {
      clientSecret: this.clientSecret,
      evaluationContext: context,
      apply: false,
      sdk: this.sdk,
      flags: flags.map(name => `flags/${name}`),
    };

    const response = await this.resolveFlags(request);
    console.log(response);
    return new FlagResolutionImpl(response, context);
  }

  private async resolveFlags(request: ResolveFlagsRequest): Promise<ResolveFlagsResponse> {
    const resp = await this.fetchImplementation(
      new Request('https://resolver.confidence.dev/v1/flags:resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }),
    );
    if (!resp.ok) {
      throw new Error(`${resp.status}: ${resp.statusText}`);
    }
    return resp.json();
  }
}

type ReasonSuffix<R> = R extends `RESOLVE_REASON_${infer S}` ? S : never;

function toEvaluationReason<R extends ResolveReason>(reason: R): ReasonSuffix<R> {
  return reason.slice('RESOLVE_REASON_'.length) as ReasonSuffix<R>;
}
