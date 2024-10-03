/**
 * Convenient type alias for the full fetch API
 */
type Fetch = typeof fetch;

export const enum TimeUnit {
  SECOND = 1000,
  MINUTE = 60 * TimeUnit.SECOND,
}

/**
 * The full fetch API has overloaded variants which makes it very cumbersome
 * to compose, therefore we define SimpleFetch, as just the simplest of the fetch
 * overloads.
 *
 * Hence fetch itself is of type SimpleFetch i.e.
 * ```
 * const simple:SimpleFetch = fetch // ok
 * ```
 *
 * It's also easy to get back the full fetch API thanks to the Request constructor
 * ```
 * const fullFetch:Fetch = (input, init) => simple(new Request(input, init))
 * ```
 */
type SimpleFetch = (request: Request) => Promise<Response>;

/**
 * A function that takes a SimpleFetch and returns a new SimpleFetch
 * with some desired behavior applied.
 */
type FetchPrimitive = (next: SimpleFetch) => SimpleFetch;

export class RequestError extends Error {}
export class TimeoutError extends RequestError {
  constructor() {
    super('Request timed out');
  }
}

/**
 * Build a fetch function by adding "primitives" such as retry, rateLimit and timeout.
 *
 * Example usage:
 * ```
 * const customFetch = new FetchBuilder()
 *    .timeout(1000)
 *    .retry()
 *    .rateLimit()
 *    .build(fetch);
 *
 * const resp = await customFetch('http://test.com');
 * ```
 *
 * The primitives apply in the same order they are written.
 *
 * @privateRemarks
 *
 * The primitive implementations all follow a common pattern of just adding a composition:
 * ```
 * noopPrimitive(): this {
 *  return this.compose(next => async request => {
 *    // here we're "in" a fetch call and could modify the request
 *    const response = await next(request);
 *    // after the upstream call, we could also modify the response
 *    return response;
 *  })
 * }
 * ```
 *
 */
export class FetchBuilder {
  impl?: FetchPrimitive;

  /**
   * Compose a fetch primitive (inner) with the existing primitive in the builder (outer).
   *
   * @param inner - the primitive to add to the chain
   * @returns the builder itself
   */
  private compose(inner: FetchPrimitive): this {
    const outer = this.impl;
    if (outer) {
      this.impl = next => outer(inner(next));
    } else {
      // in the initial state we don't have outer and no composition is needed
      this.impl = inner;
    }
    return this;
  }

  /**
   * Apply a timeout that aborts the ongoing request with a {@link TimeoutError}
   *
   * @param duration - milliseconds after which to abort
   * @returns the builder itself
   */
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

  /**
   * Only allow one outstanding request. If a new request is made, the existing request it aborted with {@link RequestError}
   *
   * @returns the builder itself
   */
  abortPrevious(): this {
    let abortPrevious: (() => void) | undefined;
    return this.compose(next => request => {
      abortPrevious?.();
      const [abortableRequest, abort] = makeAbortable(request);
      abortPrevious = () => abort(new RequestError('Request superseded'));
      return next(abortableRequest);
    });
  }

  /**
   * Turn all non 200 responses into {@link RequestError} rejections.
   *
   * @returns the builder itself
   */
  rejectNotOk(): this {
    return this.rejectOn(resp => !resp.ok);
  }

  /**
   * Reject responses based on a callback examining the response.
   * Will reject the response with {@link RequestError} if the callback returns true.
   * @param callback - the callback to determine if the response should be rejected
   * @returns the builder itself
   */
  rejectOn(callback: (code: Response) => boolean) {
    return this.compose(
      next => request =>
        next(request).then(response => {
          if (callback(response)) throw new RequestError(`${response.status}: ${response.statusText}`);
          return response;
        }),
    );
  }

  /**
   * Only allow `maxPending` outstanding requests. Requests made while at the limit will directly reject with {@link RequestError}
   *
   * @param maxPending - the number of simultaneous requests supported
   * @returns the builder itself
   */
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

  /**
   * Control the rate of requests with a "token bucket" scheme. Every request requires 1 token to proceed.
   * Tokens are continuously produced at `tokenFillRate`, until `maxTokens`. This enables limited burstiness as
   * requests are free to proceed as long as there are more than one token available. When less than one token
   * is available requests are queued without bound. See {@link FetchBuilder.limitPending } to manage the queue size.
   *
   * @param tokenFillRate - tokens to produce per second
   * @param options.maxTokens - the number of tokens to refill
   * @param options.initialTokens - the initial number of tokens, can be larger than `maxTokens`
   * @returns the builder itself
   */
  rateLimit(tokenFillRate: number, { maxTokens = tokenFillRate, initialTokens = tokenFillRate } = {}) {
    precondition(tokenFillRate > 0, 'tokenFillRate must be positive');
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

  /**
   * Retry rejected requests.
   *
   * @param options.maxRetries - the maximum number of retires, defaults to unbounded
   * @param options.delay - the delay between retries, defaults to zero
   * @param options.backoff - multiplier for exponentially increasing the delay, defaults to `2`
   * @param options.jitter - random jitter as a ratio (.i.e `0.1` means ±10% jitter), defaults to zero
   * @param options.maxDelay - the maximum duration at which backoff will no longer apply, defaults to unbounded
   * @returns the builder itself
   */
  retry({
    maxRetries = Number.POSITIVE_INFINITY,
    delay = 0,
    maxDelay = Number.POSITIVE_INFINITY,
    backoff = 2,
    jitter = 0,
  } = {}): this {
    precondition(maxRetries >= 0, 'maxRetries must be larger or equal to zero');
    return this.compose(next => async request => {
      let retryCount = 0;

      const doRetry = async (e: unknown): Promise<Response> => {
        if (request.signal?.aborted ?? false) throw request.signal?.reason;
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

  /**
   * Modify the request.
   *
   * @param mod - a (possibly async) function to transform the request
   * @returns the builder itself
   */
  modifyRequest(mod: (request: Request) => Promise<Request> | Request): this {
    return this.compose(next => async request => next(await mod(request)));
  }

  /**
   * Possibly forward requests to another fetch implementation based on url matching.
   * Unmatched requests will proceed as usual.
   *
   * @param match - predicate matching the url
   * @param fetch - the fetch implementation to receive matching requests
   * @returns the builder itself
   */
  route(match: (url: string) => boolean, fetch: SimpleFetch) {
    return this.compose(next => request => (match(request.url) ? fetch(request) : next(request)));
  }

  /**
   * Finish the primitive composition and return a full fetch implementation.
   *
   * @param sink - the fetch implementation to send the actual request
   * @returns the built fetch implementation
   */
  build(sink: SimpleFetch): Fetch {
    const impl = this.impl ? this.impl(sink) : sink;
    return (input, init) => impl(new Request(input, init));
  }
}

/**
 * Simplifies the common task of making a request abortable, while also respecting an existing abort signal
 * ```
 * const [myRequest, abort] = makeAbortable(request);
 * // myRequest is identical to request but can be aborted by calling abort(reason)
 * ```
 * @param request - the request to clone
 * @returns tuple of the cloned request and its abort function
 */
function makeAbortable(request: Request): [request: Request, abort: (reason: unknown) => void] {
  const [signal, abort] = abortController(request.signal);
  return [new Request(request, { signal }), abort];
}

/**
 * Utility function that simplifies working with AbortController:
 * ```
 * // signal will activate when abort is called OR when someOtherSignal activates
 * const [signal, abort] = abortController(someOtherSignal);
 * ```
 * @param follow - optional AbortSignals that should be followed
 * @returns tuple of signal and corresponding abort function
 */
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

function precondition(condition: boolean, message: string): asserts condition is true {
  if (!condition) throw new TypeError(message);
}
