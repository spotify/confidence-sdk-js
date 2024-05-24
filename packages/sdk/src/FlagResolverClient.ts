import { AccessiblePromise } from './AccessiblePromise';
import { Applier, FlagResolution } from './FlagResolution';
import { Value } from './Value';
import { Context } from './context';
import { FetchBuilder, TimeUnit } from './fetch-util';
import {
  ResolveFlagsRequest,
  ResolveFlagsResponse,
  ApplyFlagsRequest,
  AppliedFlag,
} from './generated/confidence/flags/resolver/v1/api';
import { Sdk } from './generated/confidence/flags/resolver/v1/types';
import { SimpleFetch } from './types';

const FLAG_PREFIX = 'flags/';

export interface PendingResolution extends AccessiblePromise<FlagResolution> {
  readonly context: Value.Struct;
  abort(reason?: any): void;
}

export interface FlagResolverClient {
  resolve(context: Context, flags: string[]): PendingResolution;
}

export type FlagResolverClientOptions = {
  fetchImplementation: SimpleFetch;
  clientSecret: string;
  sdk: Sdk;
  applyTimeout?: number;
  environment: 'client' | 'backend';
  region?: 'eu' | 'us';
};

export class FetchingFlagResolverClient implements FlagResolverClient {
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
    const resolution = this.resolveFlagsJson(request, abortController.signal).then(response =>
      FlagResolution.create(context, response, this.createApplier(response.resolveToken)),
    );

    return Object.assign(AccessiblePromise.resolve(resolution), {
      context,
      abort: (reason?: any) => abortController.abort(reason),
    });
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

export class CachingFlagResolverClient implements FlagResolverClient {
  readonly #cache: Map<string, { timestamp: number; value: PendingResolution }> = new Map();
  readonly #source: FlagResolverClient;
  readonly #ttl: number;

  constructor(source: FlagResolverClient, ttlMs: number) {
    this.#source = source;
    this.#ttl = ttlMs;
  }

  resolve(context: Context, flags: string[]): PendingResolution {
    this.evict();
    const key = this.makeKey(context);
    let entry = this.#cache.get(key);
    if (!entry) {
      entry = {
        timestamp: Date.now(),
        value: this.#source.resolve(context, flags),
      };
      this.#cache.set(key, entry);
    }
    return entry.value;
  }

  makeKey(value: Value): string {
    const buffer: string[] = [];
    serializeValue(value, s => buffer.push(s));
    return buffer.join('');
  }

  evict() {
    const now = Date.now();
    for (const [key, { timestamp }] of this.#cache) {
      const age = now - timestamp;
      if (age < this.#ttl) return;
      this.#cache.delete(key);
    }
  }
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

// 8 byte buffer for encoding one float64
const numberBuffer = new Uint16Array(4);
function serializeValue(value: Value, sink: (value: string) => void) {
  switch (typeof value) {
    case 'string':
      sink(String.fromCharCode(0, value.length));
      sink(value);
      break;
    case 'number':
      new DataView(numberBuffer.buffer).setFloat64(0, value);
      sink(String.fromCharCode(1, ...numberBuffer));
      break;
    case 'boolean':
      sink(String.fromCharCode(value ? 2 : 3));
      break;
    case 'object':
      if (Value.isList(value)) {
        sink(String.fromCharCode(4, value.length));
        value.forEach(item => serializeValue(item, sink));
      } else if (Value.isStruct(value)) {
        const keys = Object.keys(value).filter(key => typeof value[key] !== 'undefined');
        keys.sort();
        sink(String.fromCharCode(5, keys.length));
        for (const key of keys) {
          sink(String.fromCharCode(key.length));
          sink(key);
          serializeValue(value[key], sink);
        }
      }
      break;
    default:
      throw new Error(`Unknown value: ${value}`);
  }
}
