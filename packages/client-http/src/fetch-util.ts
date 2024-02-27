type Fetch = typeof fetch;

type SimpleFetch = (request: Request) => Promise<Response>;
type FetchPrimitive = (next: SimpleFetch) => SimpleFetch;

export const enum TimeUnit {
  SECOND = 1000,
  MINUTE = 60 * TimeUnit.SECOND,
}

export class RequestError extends Error {}
export class TimeoutError extends RequestError {
  constructor() {
    super('Request timed out');
  }
}

export class FetchBuilder {
  impl?: FetchPrimitive;

  private compose(inner: FetchPrimitive): this {
    const outer = this.impl;
    this.impl = outer ? next => outer(inner(next)) : inner;
    return this;
  }

  timeout(duration: number): this {
    return this.compose(next => request => {
      const [signal, abort] = abortController(request.signal);
      // prefer using our own timeout over AbortSignal.timeout() since it plays well with fakeTimers in tests
      const timeoutId = setTimeout(() => {
        abort(new TimeoutError());
      }, duration);
      return next(new Request(request, { signal })).finally(() => {
        clearTimeout(timeoutId);
      });
    });
  }

  abortPrevious(): this {
    let abortPrevious: (() => void) | undefined;
    return this.compose(next => request => {
      abortPrevious?.();
      const [abortableRequest, abort] = makeAbortable(request);
      abortPrevious = () => abort(new RequestError('Request superseded'));
      return next(abortableRequest);
    });
  }

  rejectNotOk(): this {
    return this.compose(
      next => request =>
        next(request).then(response => {
          if (!response.ok) throw new RequestError(`${response.status}: ${response.statusText}`);
          return response;
        }),
    );
  }

  limitPending(maxPending: number): this {
    let pending = 0;
    return this.compose(next => request => {
      if (pending >= maxPending) return Promise.reject(new RequestError('Number of pending requests exceeded'));
      pending++;
      return next(request).finally(() => {
        pending--;
      });
    });
  }

  rateLimit(tokenFillRate: number, { maxTokens = tokenFillRate, initialTokens = tokenFillRate } = {}) {
    let lastRefillTime = Number.NEGATIVE_INFINITY;
    let tokens = initialTokens;
    let nextRun = Promise.resolve();

    return this.compose(next => request => {
      nextRun = nextRun
        // catch the potential abort of the previous run
        .catch(() => {})
        .then(async () => {
          refillTokens();
          // we can only send a request if we have at least one token
          if (tokens < 1) {
            // wait until tokens is one
            await abortableSleep(((1 - tokens) / tokenFillRate) * 1000, request.signal);
          }
        });
      return nextRun.then(() => {
        tokens--;
        return next(request);
      });
    });

    function refillTokens() {
      const currentTime = Date.now();
      // initialTokens might be higher than maxTokens, so we don't refill until we've dropped below maxTokens
      if (Number.isFinite(lastRefillTime) && tokens < maxTokens) {
        const elapsed = (currentTime - lastRefillTime) / 1000;
        tokens = Math.min(maxTokens, tokens + elapsed * tokenFillRate);
      }
      lastRefillTime = currentTime;
    }
  }

  retry({
    maxRetries = Number.POSITIVE_INFINITY,
    delay = 0,
    maxDelay = Number.POSITIVE_INFINITY,
    backoff = 2,
    jitter = 0,
  } = {}): this {
    return this.compose(next => async request => {
      let retryCount = 0;

      const doRetry = async (e: unknown): Promise<Response> => {
        // if there are no more attempts we throw the last error
        if (retryCount >= maxRetries) throw e;

        const jitterFactor = 1 + 2 * Math.random() * jitter - jitter;
        await abortableSleep(jitterFactor * Math.min(maxDelay, delay * Math.pow(backoff, retryCount)), request.signal);
        retryCount++;
        return next(request.clone()).catch(doRetry);
      };

      return next(request.clone()).catch(doRetry);
    });
  }

  modifyRequest(mod: (request: Request) => Promise<Request>): this {
    return this.compose(next => async request => next(await mod(request)));
  }

  route(match: (url: string) => boolean, fetch: SimpleFetch) {
    return this.compose(next => request => match(request.url) ? fetch(request) : next(request));
  }

  build(sink: SimpleFetch): Fetch {
    const impl = this.impl ? this.impl(sink) : sink;
    return (input, init) => impl(new Request(input, init));
  }
}

function makeAbortable(request: Request): [request: Request, abort: (reason: unknown) => void] {
  const [signal, abort] = abortController(request.signal);
  return [new Request(request, { signal }), abort];
}

function abortController(...follow: AbortSignal[]): [signal: AbortSignal, abort: (reason: unknown) => void] {
  const controller = new AbortController();

  function listener(this: AbortSignal) {
    controller.abort(this.reason);
  }

  for (const signal of follow) {
    // request should always have signal, but the cross-fetch polyfill used in tests doesn't comply, hence this check
    if (!signal) continue;
    signal.addEventListener('abort', listener);
  }
  return [controller.signal, controller.abort.bind(controller)];
}

export function abortableSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal) {
      const abort = () => reject(signal.reason);
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener('abort', abort);
    }
    setTimeout(resolve, milliseconds);
  });
}
