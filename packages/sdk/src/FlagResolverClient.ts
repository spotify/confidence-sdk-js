import { Schema } from './Schema';
import { Value } from './Value';
import { Context } from './context';
import { TypeMismatchError } from './error';
import { FlagEvaluation, FlagResolution } from './flags';
import {
  ResolveFlagsRequest,
  ResolveFlagsResponse,
  ApplyFlagsRequest,
  AppliedFlag,
} from './generated/confidence/flags/resolver/v1/api';
import { ResolveReason, Sdk } from './generated/confidence/flags/resolver/v1/types';
import { SimpleFetch } from './types';

const FLAG_PREFIX = 'flags/';

type ResolvedFlag = {
  schema: Schema;
  value: Value.Struct;
  variant: string;
  reason:
    | 'UNSPECIFIED'
    | 'MATCH'
    | 'NO_SEGMENT_MATCH'
    | 'NO_TREATMENT_MATCH'
    | 'FLAG_ARCHIVED'
    | 'TARGETING_KEY_ERROR'
    | 'ERROR';
};

type Applier = (flagName: string) => void;
class FlagResolutionImpl implements FlagResolution {
  private readonly flags: Map<string, ResolvedFlag> = new Map();

  constructor(
    readonly context: Value.Struct,
    resolveResponse: ResolveFlagsResponse,
    private readonly applier?: Applier,
  ) {
    for (const { flag, variant, value, reason, flagSchema } of resolveResponse.resolvedFlags) {
      const name = flag.slice(FLAG_PREFIX.length);

      const schema = flagSchema ? Schema.parse({ structSchema: flagSchema }) : Schema.UNDEFINED;
      this.flags.set(name, {
        schema,
        value: value! as Value.Struct,
        variant,
        reason: toEvaluationReason(reason),
      });
    }
  }

  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
    try {
      const [name, ...steps] = path.split('.');
      const flag = this.flags.get(name);
      if (!flag) {
        return {
          reason: 'ERROR',
          value: defaultValue,
          errorCode: 'FLAG_NOT_FOUND',
          errorMessage: `Flag "${name}" not found`,
        };
      }
      const reason = flag.reason;
      if (reason === 'ERROR') throw new Error('Unknown resolve error');

      const value = TypeMismatchError.hoist(name, () => Value.get(flag.value, ...steps) as T);

      const schema = flag.schema.get(...steps);
      TypeMismatchError.hoist(['defaultValue', ...steps], () => {
        schema.assertAssignsTo(defaultValue);
      });

      if (reason !== 'MATCH') {
        return {
          reason,
          value: defaultValue,
        };
      }
      this.applier?.(name);
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
  applyTimeout?: number;
};
export class FlagResolverClient {
  private readonly fetchImplementation: SimpleFetch;
  private readonly clientSecret: string;
  private readonly sdk: Sdk;
  private readonly applyTimeout?: number;

  constructor({ fetchImplementation, clientSecret, sdk, applyTimeout }: FlagResolverClientOptions) {
    this.fetchImplementation = fetchImplementation;
    this.clientSecret = clientSecret;
    this.sdk = sdk;
    this.applyTimeout = applyTimeout;
  }

  async resolve(context: Context, flags: string[]): Promise<FlagResolution> {
    const useBackendApply = !this.applyTimeout;
    const request: ResolveFlagsRequest = {
      clientSecret: this.clientSecret,
      evaluationContext: context,
      apply: useBackendApply,
      sdk: this.sdk,
      flags: flags.map(name => FLAG_PREFIX + name),
    };

    const response = await this.resolveFlagsJson(request);

    return new FlagResolutionImpl(
      context,
      response,
      useBackendApply ? undefined : this.createApplier(response.resolveToken),
    );
  }

  createApplier(resolveToken: Uint8Array): Applier {
    const applied = new Set<string>();
    const pending: AppliedFlag[] = [];
    const flush = () => {
      timeoutId = 0;
      this.apply({
        flags: pending.splice(0, pending.length),
        clientSecret: this.clientSecret,
        resolveToken,
        sdk: this.sdk,
        sendTime: new Date(),
      });
    };
    let timeoutId = 0;
    return (flagName: string) => {
      if (applied.has(flagName)) return;
      applied.add(flagName);
      pending.push({
        flag: FLAG_PREFIX + flagName,
        applyTime: new Date(),
      });
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = Number(setTimeout(flush, this.applyTimeout));
    };
  }

  async apply(request: ApplyFlagsRequest): Promise<void> {
    const resp = await this.fetchImplementation(
      new Request('https://resolver.confidence.dev/v1/flags:apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ApplyFlagsRequest.toJSON(request)),
      }),
    );
    if (!resp.ok) {
      throw new Error(`${resp.status}: ${resp.statusText}`);
    }
  }

  async resolveFlagsJson(request: ResolveFlagsRequest): Promise<ResolveFlagsResponse> {
    const resp = await this.fetchImplementation(
      new Request('https://resolver.confidence.dev/v1/flags:resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ResolveFlagsRequest.toJSON(request)),
      }),
    );
    if (!resp.ok) {
      throw new Error(`${resp.status}: ${resp.statusText}`);
    }
    return ResolveFlagsResponse.fromJSON(await resp.json());
  }
  // async resolveFlagsProto(request: ResolveFlagsRequest): Promise<ResolveFlagsResponse> {
  //   const resp = await this.fetchImplementation(
  //     new Request('https://resolver.confidence.dev/v1/flags:resolve', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/x-protobuf',
  //       },
  //       body: ResolveFlagsRequest.encode(request).finish(),
  //     }),
  //   );
  //   if (!resp.ok) {
  //     throw new Error(`${resp.status}: ${resp.statusText}`);
  //   }
  //   return ResolveFlagsResponse.decode(new Uint8Array(await resp.arrayBuffer()));
  // }
}

function toEvaluationReason(reason: ResolveReason): FlagEvaluation<unknown>['reason'] {
  switch (reason) {
    case ResolveReason.RESOLVE_REASON_UNSPECIFIED:
      return 'UNSPECIFIED';
    case ResolveReason.RESOLVE_REASON_MATCH:
      return 'MATCH';
    case ResolveReason.RESOLVE_REASON_NO_SEGMENT_MATCH:
      return 'NO_SEGMENT_MATCH';
    case ResolveReason.RESOLVE_REASON_NO_TREATMENT_MATCH:
      return 'NO_TREATMENT_MATCH';
    case ResolveReason.RESOLVE_REASON_FLAG_ARCHIVED:
      return 'FLAG_ARCHIVED';
    case ResolveReason.RESOLVE_REASON_TARGETING_KEY_ERROR:
      return 'TARGETING_KEY_ERROR';
    case ResolveReason.RESOLVE_REASON_ERROR:
      return 'ERROR';
  }
  return 'UNSPECIFIED';
}
