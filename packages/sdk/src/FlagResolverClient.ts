import { FlagEvaluation } from '.';
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

export class ResolveError extends Error {
  constructor(public readonly code: FlagEvaluation.ErrorCode, message: string) {
    super(message);
  }
}
export class PendingResolution<T = FlagResolution> extends AccessiblePromise<T> {
  #context: Context;
  #controller: AbortController;

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  protected constructor(promise: PromiseLike<T>, context: Context, controller: AbortController, rejected?: boolean) {
    super(promise, rejected);
    this.#context = context;
    this.#controller = controller;
  }

  protected chain<S>(value: any, rejected?: boolean | undefined): PendingResolution<S> {
    return new PendingResolution(value, this.#context, this.#controller, rejected);
  }

  get context(): Context {
    return this.#context;
  }

  abort(): void {
    this.#controller.abort();
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): PendingResolution<TResult1 | TResult2> {
    return super.then(onfulfilled, onrejected) as PendingResolution<TResult1 | TResult2>;
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined,
  ): PendingResolution<T | TResult> {
    return super.catch(onrejected) as PendingResolution<T | TResult>;
  }

  finally(onfinally?: (() => void) | null | undefined): PendingResolution<T> {
    return super.finally(onfinally) as PendingResolution<T>;
  }

  static create(
    context: Context,
    executor: (signal: AbortSignal) => PromiseLike<FlagResolution>,
  ): PendingResolution<FlagResolution> {
    const controller = new AbortController();
    return new PendingResolution(executor(controller.signal), context, controller);
  }
}

export interface FlagResolverClient {
  resolve(context: Context, flags: string[]): PendingResolution;
}

export type FlagResolverClientOptions = {
  fetchImplementation: SimpleFetch;
  clientSecret: string;
  sdk: Sdk;
  applyTimeout?: number;
  resolveTimeout: number;
  environment: 'client' | 'backend';
  region?: 'eu' | 'us';
};

export class FetchingFlagResolverClient implements FlagResolverClient {
  private readonly fetchImplementation: SimpleFetch;
  private readonly clientSecret: string;
  private readonly sdk: Sdk;
  private readonly applyTimeout?: number;
  private readonly resolveTimeout: number;
  private readonly baseUrl: string;

  constructor({
    fetchImplementation,
    clientSecret,
    sdk,
    applyTimeout,
    resolveTimeout,
    // todo refactor to move out environment
    environment,
    region,
  }: FlagResolverClientOptions) {
    // TODO think about both resolve and apply request logic for backends
    this.fetchImplementation = environment === 'backend' ? fetchImplementation : withRequestLogic(fetchImplementation);
    this.clientSecret = clientSecret;
    this.sdk = sdk;
    this.applyTimeout = applyTimeout;
    this.baseUrl = region ? `https://resolver.${region}.confidence.dev/v1` : 'https://resolver.confidence.dev/v1';
    this.resolveTimeout = resolveTimeout;
  }

  resolve(context: Context, flags: string[]): PendingResolution {
    const request: ResolveFlagsRequest = {
      clientSecret: this.clientSecret,
      evaluationContext: context,
      apply: false,
      sdk: this.sdk,
      flags: flags.map(name => FLAG_PREFIX + name),
    };

    return PendingResolution.create(context, signal => {
      const signalWithTimeout = withTimeout(
        signal,
        this.resolveTimeout,
        new ResolveError('TIMEOUT', 'Resolve timeout'),
      );
      return this.resolveFlagsJson(request, signalWithTimeout)
        .then(response => FlagResolution.ready(context, response, this.createApplier(response.resolveToken)))
        .catch(error => {
          if (error instanceof ResolveError) {
            return FlagResolution.failed(context, error.code, error.message);
          }
          throw error;
        });
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
  readonly #cache: Map<string, { timestamp: number; value: PendingResolution; refCount: number }> = new Map();
  readonly #source: FlagResolverClient;
  readonly #ttl: number;

  constructor(source: FlagResolverClient, ttlMs: number) {
    this.#source = source;
    this.#ttl = ttlMs;
  }

  resolve(context: Context, flags: string[]): PendingResolution {
    this.evict();
    const key = Value.serialize(context);
    let entry = this.#cache.get(key);
    if (!entry) {
      const value = this.#source.resolve(context, flags);
      entry = { refCount: 1, timestamp: Date.now(), value };
      this.#cache.set(key, entry);

      value.signal.addEventListener(
        'abort',
        () => {
          this.#cache.delete(key);
        },
        { once: true },
      );

      // value.catch(() => {
      //   this.#cache.delete(key);
      // });
    } else {
      entry.refCount++;
    }
    return PendingResolution.create(context, signal => {
      signal.addEventListener(
        'abort',
        () => {
          if (--entry!.refCount === 0) {
            entry!.value.abort();
          }
        },
        { once: true },
      );
      return entry!.value;
    });
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

function withTimeout(signal: AbortSignal, timeout: number, reason?: any): AbortSignal {
  const controller = new AbortController();
  const timeoutId: NodeJS.Timeout | number = setTimeout(() => controller.abort(reason), timeout);
  // in Node setTimeout returns an object, with an unref function which will prevent the timeout from keeping the process alive
  if (typeof timeoutId === 'object') timeoutId.unref();
  signal.addEventListener('abort', () => {
    clearTimeout(timeoutId);
    controller.abort(signal.reason);
  });
  return controller.signal;
}
