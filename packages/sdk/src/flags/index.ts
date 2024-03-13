import {
  ConfidenceClient,
  ConfidenceClientOptions,
  FetchBuilder,
  Configuration as FlagResolution,
  TimeUnit,
  ApplyManager,
  abortableSleep,
} from '@spotify-confidence/client-http';

export interface FlagResolverOptions extends ConfidenceClientOptions {
  environment: 'client' | 'backend';
}

class FlagResolverClient extends ConfidenceClient {
  constructor({ fetchImplementation, environment, ...options }: FlagResolverOptions) {
    super({
      ...options,
      fetchImplementation: environment === 'client' ? withRequestLogic(fetchImplementation) : fetchImplementation,
    });
  }
}

export { FlagResolverClient, FlagResolution, ApplyManager, abortableSleep };

export function withRequestLogic(fetchImplementation: (request: Request) => Promise<Response>): typeof fetch {
  const fetchResolve = new FetchBuilder()
    // always cancel previous resolve
    .abortPrevious()
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
