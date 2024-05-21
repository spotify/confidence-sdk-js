import { Schema } from './Schema';
import { Value } from './Value';
import { Context } from './context';
import { TypeMismatchError } from './error';
import { FetchBuilder, TimeUnit } from './fetch-util';
import { FlagEvaluation } from './flags';
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

export interface FlagResolution {
  readonly context: Value.Struct;
  // readonly flagNames:string[]
  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation.Resolved<T>;
}

class FlagResolutionImpl implements FlagResolution {
  private readonly flags: Map<string, ResolvedFlag> = new Map();
  readonly resolveToken: string;

  constructor(
    readonly context: Value.Struct,
    resolveResponse: ResolveFlagsResponse,
    private readonly applier?: Applier,
  ) {
    for (const { flag, variant, value, reason, flagSchema } of resolveResponse.resolvedFlags) {
      const name = flag.slice(FLAG_PREFIX.length);

      const schema = flagSchema ? Schema.parse({ structSchema: flagSchema }) : Schema.ANY;
      this.flags.set(name, {
        schema,
        value: value! as Value.Struct,
        variant,
        reason: toEvaluationReason(reason),
      });
    }
    this.resolveToken = base64FromBytes(resolveResponse.resolveToken);
  }

  evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation.Resolved<T> {
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
      if (reason !== 'MATCH') {
        if (reason === 'NO_SEGMENT_MATCH' && this.applier) {
          this.applier?.(name);
        }
        return {
          reason,
          value: defaultValue,
        };
      }

      const value = TypeMismatchError.hoist(name, () => Value.get(flag.value, ...steps) as T);

      const schema = flag.schema.get(...steps);
      TypeMismatchError.hoist(['defaultValue', ...steps], () => {
        schema.assertAssignsTo(defaultValue);
      });

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

export interface PendingResolution extends Promise<FlagResolution> {
  readonly context: Value.Struct;
  abort(reason?: any): void;
}

export type FlagResolverClientOptions = {
  fetchImplementation: SimpleFetch;
  clientSecret: string;
  sdk: Sdk;
  applyTimeout?: number;
  environment: 'client' | 'backend';
  region?: 'eu' | 'us';
};
export class FlagResolverClient {
  private readonly fetchImplementation: SimpleFetch;
  private readonly clientSecret: string;
  private readonly sdk: Sdk;
  private readonly applyTimeout?: number;
  private readonly baseUrl: string;

  constructor({
    fetchImplementation,
    clientSecret,
    sdk,
    applyTimeout,
    // todo refactor to move out environment
    environment,
    region,
  }: FlagResolverClientOptions) {
    // TODO think about both resolve and apply request logic for backends
    this.fetchImplementation = environment === 'client' ? withRequestLogic(fetchImplementation) : fetchImplementation;
    this.clientSecret = clientSecret;
    this.sdk = sdk;
    this.applyTimeout = applyTimeout;
    this.baseUrl = region ? `https://resolver.${region}.confidence.dev/v1` : 'https://resolver.confidence.dev/v1';
  }

  resolve(context: Context, flags: string[]): PendingResolution {
    const request: ResolveFlagsRequest = {
      clientSecret: this.clientSecret,
      evaluationContext: context,
      apply: false,
      sdk: this.sdk,
      flags: flags.map(name => FLAG_PREFIX + name),
    };
    const abortController = new AbortController();
    const resolution = this.resolveFlagsJson(request, abortController.signal).then(
      response => new FlagResolutionImpl(context, response, this.createApplier(response.resolveToken)),
    );

    return Object.assign(resolution, { context, abort: (reason?: any) => abortController.abort(reason) });
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
      new Request(`${this.baseUrl}/flags:apply`, {
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

  async resolveFlagsJson(request: ResolveFlagsRequest, signal: AbortSignal): Promise<ResolveFlagsResponse> {
    const resp = await this.fetchImplementation(
      new Request(`${this.baseUrl}/flags:resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ResolveFlagsRequest.toJSON(request)),
        signal,
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

function toEvaluationReason(reason: ResolveReason): Exclude<FlagEvaluation<unknown>['reason'], 'PENDING'> {
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
    default:
      return 'UNSPECIFIED';
  }
}

function base64FromBytes(arr: Uint8Array): string {
  if ((globalThis as any).Buffer) {
    return globalThis.Buffer.from(arr).toString('base64');
  }
  const bin: string[] = [];
  arr.forEach(byte => {
    bin.push(globalThis.String.fromCharCode(byte));
  });
  return globalThis.btoa(bin.join(''));
}

export function withRequestLogic(fetchImplementation: (request: Request) => Promise<Response>): typeof fetch {
  const fetchResolve = new FetchBuilder()
    // infinite retries without delay until aborted by timeout
    .retry()
    .rejectNotOk()
    .rateLimit(1, { initialTokens: 3, maxTokens: 2 })
    .build(fetchImplementation);

  const fetchApply = new FetchBuilder()
    .limitPending(1000)
    .timeout(30 * TimeUnit.MINUTE)
    .retry({ delay: 5 * TimeUnit.SECOND, backoff: 2, maxDelay: 5 * TimeUnit.MINUTE, jitter: 0.2 })
    .rejectNotOk()
    .rateLimit(2)
    // update send-time before sending
    .modifyRequest(async request => {
      if (request.method === 'POST') {
        const body = JSON.stringify({ ...(await request.json()), sendTime: new Date().toISOString() });
        return new Request(request, { body });
      }
      return request;
    })
    .build(fetchImplementation);

  return (
    new FetchBuilder()
      .route(url => url.endsWith('flags:resolve'), fetchResolve)
      .route(url => url.endsWith('flags:apply'), fetchApply)
      // throw so we notice changes in endpoints that should be handled here
      .build(request => Promise.reject(new Error(`Unexpected url: ${request.url}`)))
  );
}
