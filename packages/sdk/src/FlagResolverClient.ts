import {
  ConfidenceClient,
  ConfidenceClientOptions,
  FetchBuilder,
  Configuration as FlagResolution,
  TimeUnit,
  ApplyManager,
  abortableSleep,
} from '@spotify-confidence/client-http';
import { Context } from './context';

const APPLY_TIMEOUT = 250;
const MAX_APPLY_BUFFER_SIZE = 20;
export interface FlagResolverOptions extends Omit<ConfidenceClientOptions, 'apply'> {
  environment: 'client' | 'backend';
}

export class PendingFlagResolution implements PromiseLike<FlagResolution> {
  readonly #controller = new AbortController();

  readonly then: <TResult1 = FlagResolution, TResult2 = never>(
    onfulfilled?: ((value: FlagResolution) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ) => PromiseLike<TResult1 | TResult2>;
  readonly abort: (reason?: any) => void;

  constructor(readonly context: Context, executor: (signal: AbortSignal) => Promise<FlagResolution>) {
    const promise = executor(this.#controller.signal);
    this.then = promise.then.bind(promise);
    this.abort = this.#controller.abort.bind(this.#controller);
  }
}
export class FlagResolverClient {
  private readonly legacyClient: ConfidenceClient;
  private readonly applyManager?: ApplyManager;

  constructor({ fetchImplementation, environment, ...options }: FlagResolverOptions) {
    this.legacyClient = new ConfidenceClient({
      ...options,
      apply: environment === 'backend',
      fetchImplementation: environment === 'client' ? withRequestLogic(fetchImplementation) : fetchImplementation,
    });
    if (environment === 'client') {
      this.applyManager = new ApplyManager({
        client: this.legacyClient,
        timeout: APPLY_TIMEOUT,
        maxBufferSize: MAX_APPLY_BUFFER_SIZE,
      });
    }
  }

  resolve(context: Context, flags: string[]): PendingFlagResolution {
    return new PendingFlagResolution(context, signal => this.legacyClient.resolve(context, { flags, signal }));
  }

  apply(resolveToken: string, flagName: string): void {
    this.applyManager?.apply(resolveToken, flagName);
  }
}

export { FlagResolution, abortableSleep };

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
