import { FlagEvaluation } from '.';
import { AccessiblePromise } from './AccessiblePromise';
import { Applier, FlagResolution } from './FlagResolution';
import { Telemetry, TraceConsumer } from './Telemetry';
import { CacheProvider } from './flag-cache';
import { Context } from './context';
import { FetchBuilder, InternalFetch, SimpleFetch, TimeUnit } from './fetch-util';
import {
  ResolveFlagsRequest,
  ResolveFlagsResponse,
  ApplyFlagsRequest,
  AppliedFlag,
} from './generated/confidence/flags/resolver/v1/api';
import { Sdk } from './generated/confidence/flags/resolver/v1/types';
import {
  LibraryTraces_Library,
  LibraryTraces_Trace_RequestTrace_Status as TraceStatus,
  LibraryTraces_TraceId,
  Monitoring,
} from './generated/confidence/telemetry/v1/telemetry';
import { Logger } from './logger';
import { WaitUntil } from './types';

const FLAG_PREFIX = 'flags/';
const retryCodes = new Set([408, 502, 503, 504]);

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
  applyDebounce: number;
  resolveTimeout: number;
  environment: 'client' | 'backend';
  region?: 'eu' | 'us';
  resolveBaseUrl?: string;
  telemetry: Telemetry;
  logger: Logger;
  waitUntil?: WaitUntil;
  cacheProvider?: CacheProvider;
};

export class FetchingFlagResolverClient implements FlagResolverClient {
  private readonly fetchImplementation: InternalFetch;
  private readonly clientSecret: string;
  private readonly sdk: Sdk;
  private readonly applyDebounce: number;
  private readonly resolveTimeout: number;
  private readonly baseUrl: string;
  private readonly traceConsumer: TraceConsumer;
  private readonly waitUntil: WaitUntil | undefined;
  private readonly cacheReadThrough: (
    context: Context,
    supplier: () => Promise<ResolveFlagsResponse>,
  ) => Promise<{ response: ResolveFlagsResponse; isFromCache: boolean }>;

  constructor({
    fetchImplementation,
    clientSecret,
    sdk,
    applyDebounce,
    resolveTimeout,
    // todo refactor to move out environment
    environment,
    region,
    resolveBaseUrl,
    telemetry,
    logger,
    waitUntil,
    cacheProvider,
  }: FlagResolverClientOptions) {
    this.traceConsumer = telemetry.registerLibraryTraces({
      library: LibraryTraces_Library.LIBRARY_CONFIDENCE,
      version: sdk.version,
      id: LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY,
    });

    const fetchBuilder = new FetchBuilder();
    withTelemetryData(fetchBuilder, telemetry);
    if (environment === 'client') {
      withRequestLogic(fetchBuilder, logger);
    }

    this.fetchImplementation = fetchBuilder.build(fetchImplementation);

    this.clientSecret = clientSecret;
    this.sdk = sdk;
    this.applyDebounce = applyDebounce;
    if (resolveBaseUrl) {
      this.baseUrl = `${resolveBaseUrl}/v1`;
    } else {
      this.baseUrl = region ? `https://resolver.${region}.confidence.dev/v1` : 'https://resolver.confidence.dev/v1';
    }
    this.resolveTimeout = resolveTimeout;
    this.waitUntil = waitUntil;
    if (cacheProvider) {
      this.cacheReadThrough = (context, supplier) => {
        const cache = cacheProvider(this.clientSecret);
        let isFromCache = true; // Default to true, will be set to false if supplier is called

        // Create a wrapper supplier that sets the flag when called
        const wrappedSupplier = async () => {
          isFromCache = false;
          return supplier();
        };

        return cache.get(context, wrappedSupplier).then(response => {
          return { response, isFromCache };
        });
      };
    } else {
      this.cacheReadThrough = (_context, supplier) => supplier().then(response => ({ response, isFromCache: false }));
    }
  }

  private markLatency(latency: number, status: TraceStatus): void {
    this.traceConsumer({
      requestTrace: {
        millisecondDuration: latency,
        status,
      },
    });
  }

  resolve(context: Context): PendingResolution {
    const request: ResolveFlagsRequest = {
      clientSecret: this.clientSecret,
      evaluationContext: context,
      apply: false,
      sdk: this.sdk,
      flags: [],
    };

    return PendingResolution.create(context, signal => {
      const signalWithTimeout = withTimeout(
        signal,
        this.resolveTimeout,
        new ResolveError('TIMEOUT', 'Resolve timeout'),
      );
      const start = Date.now();

      return this.cacheReadThrough(context, () => this.resolveFlagsJson(request, signalWithTimeout))
        .then(result => {
          const latency = Date.now() - start;
          if (result.isFromCache) {
            this.markLatency(latency, TraceStatus.STATUS_CACHED);
          } else {
            this.markLatency(latency, TraceStatus.STATUS_SUCCESS);
          }

          return FlagResolution.ready(context, result.response, this.createApplier(result.response.resolveToken));
        })
        .catch(error => {
          const latency = Date.now() - start;
          if (error instanceof ResolveError) {
            if (error.code === 'TIMEOUT') {
              this.markLatency(latency, TraceStatus.STATUS_TIMEOUT);
            } else {
              this.markLatency(latency, TraceStatus.STATUS_ERROR);
            }
          } else {
            this.markLatency(latency, TraceStatus.STATUS_ERROR);
          }
          return FlagResolution.failed(context, error instanceof ResolveError ? error.code : 'GENERAL', error.message);
        });
    });
  }

  createApplier(resolveToken: Uint8Array): Applier {
    const applied = new Set<string>();
    const pending: AppliedFlag[] = [];
    let [nextFlush, resolveNextFlush] = resolvablePromise();

    const flush = () => {
      const resolveCurrentFlush = resolveNextFlush;
      [nextFlush, resolveNextFlush] = resolvablePromise();
      timeoutId = 0;
      this.apply({
        flags: pending.splice(0, pending.length),
        clientSecret: this.clientSecret,
        resolveToken,
        sdk: this.sdk,
        sendTime: new Date(),
      }).finally(resolveCurrentFlush);
    };

    let timeoutId = 0;
    return (flagName: string) => {
      if (applied.has(flagName)) return;
      this.waitUntil?.(nextFlush);
      applied.add(flagName);
      pending.push({
        flag: FLAG_PREFIX + flagName,
        applyTime: new Date(),
      });
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (this.applyDebounce === 0) {
        flush();
      } else {
        timeoutId = Number(setTimeout(flush, this.applyDebounce));
      }
    };
  }

  async apply(request: ApplyFlagsRequest): Promise<void> {
    const resp = await this.fetchImplementation(`${this.baseUrl}/flags:apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ApplyFlagsRequest.toJSON(request)),
    });
    if (!resp.ok) {
      throw new Error(`${resp.status}: ${resp.statusText}`);
    }
  }

  async resolveFlagsJson(request: ResolveFlagsRequest, signal: AbortSignal): Promise<ResolveFlagsResponse> {
    const resp = await this.fetchImplementation(`${this.baseUrl}/flags:resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ResolveFlagsRequest.toJSON(request)),
      signal,
    });
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

export function withTelemetryData(fetchBuilder: FetchBuilder, telemetry: Telemetry) {
  fetchBuilder.modifyRequest(({ headers }) => {
    const monitoring = telemetry.getSnapshot();
    if (monitoring.libraryTraces.length > 0) {
      const base64Message = btoa(String.fromCharCode(...Monitoring.encode(monitoring).finish()));

      return { headers: { ...headers, ['X-CONFIDENCE-TELEMETRY']: base64Message } };
    }
    return {};
  });
}

export function withRequestLogic(fetchBuilder: FetchBuilder, logger: Logger) {
  const fetchResolve = new FetchBuilder()
    // infinite retries without delay until aborted by timeout
    .compose(next => async request => {
      try {
        const response = await next(request);
        return response;
      } catch (error) {
        logger.error?.(`Confidence: ${error}`);
        throw error;
      }
    })
    .rejectNotOk()
    .retry()
    .rejectOn(response => retryCodes.has(response.status))
    .rateLimit(1, { initialTokens: 3, maxTokens: 2 });

  const fetchApply = new FetchBuilder()
    .limitPending(1000)
    .timeout(30 * TimeUnit.MINUTE)
    .rejectNotOk()
    .retry({ delay: 5 * TimeUnit.SECOND, backoff: 2, maxDelay: 5 * TimeUnit.MINUTE, jitter: 0.2 })
    .rejectOn(response => retryCodes.has(response.status))
    .rateLimit(2)
    // update send-time before sending
    .modifyRequest(({ method, body }) => {
      if (method === 'POST' && body) {
        body = JSON.stringify({ ...JSON.parse(body), sendTime: new Date().toISOString() });
        return { body };
      }
      return {};
    });

  fetchBuilder
    .route(url => url.endsWith('flags:resolve'), fetchResolve)
    .route(url => url.endsWith('flags:apply'), fetchApply);
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

function resolvablePromise<T = void>(): [
  promise: Promise<T>,
  resolve: (value: T) => void,
  reject: (reason: any) => void,
] {
  let resolve: (value: T) => void;
  let reject: (reason: any) => void;
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return [promise, resolve!, reject!];
}
