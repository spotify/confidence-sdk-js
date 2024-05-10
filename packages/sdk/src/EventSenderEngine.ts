import { Value } from './Value';
import { Logger } from './logger';
import { FetchBuilder, TimeUnit } from './fetch-util';
interface Event {
  eventDefinition: string;
  eventTime: string;
  payload: Value.Struct;
}

interface EventBatch {
  sendTime: string;
  clientSecret: string;
  events: Event[];
}
interface PublishError {
  index: number;
  reason: string;
  message: string;
}

export interface EventSenderEngineOptions {
  clientSecret: string;
  maxBatchSize: number;
  flushTimeoutMilliseconds: number;
  rateLimitRps?: number;
  fetchImplementation: FetchImplementation;
  region: 'eu' | 'us';
  maxOpenRequests: number;
  logger: Logger;
}

type FetchImplementation = typeof fetch;

export class EventSenderEngine {
  private readonly writeQueue: Event[] = [];
  private readonly flushTimeoutMilliseconds: number;
  private readonly clientSecret: string;
  private readonly maxBatchSize: number;
  private readonly fetchImplementation: FetchImplementation;
  private readonly publishUrl: string;
  private readonly logger: Logger;
  private pendingFlush: undefined | ReturnType<typeof setTimeout>;

  constructor({
    clientSecret,
    maxBatchSize,
    flushTimeoutMilliseconds,
    fetchImplementation,
    region,
    rateLimitRps = 1000 / flushTimeoutMilliseconds,
    maxOpenRequests,
    logger,
  }: EventSenderEngineOptions) {
    this.publishUrl = `https://events.${region}.confidence.dev/v1/events:publish`;
    this.clientSecret = clientSecret;
    this.maxBatchSize = maxBatchSize;
    this.flushTimeoutMilliseconds = flushTimeoutMilliseconds;
    this.logger = logger;
    const fetchBuilder = new FetchBuilder()
      .limitPending(maxOpenRequests)
      .rejectNotOk()
      .timeout(30 * TimeUnit.MINUTE)
      .retry({ delay: 5 * TimeUnit.SECOND, backoff: 2, maxDelay: 5 * TimeUnit.MINUTE, jitter: 0.2 })
      .rejectOn(({ status }) => status >= 500 || status === 429);

    if (rateLimitRps) {
      fetchBuilder.rateLimit(rateLimitRps);
    }
    this.fetchImplementation = fetchBuilder
      // update send-time before sending
      .modifyRequest(async request => {
        if (request.method === 'POST') {
          const body = JSON.stringify({ ...(await request.json()), sendTime: new Date().toISOString() });
          return new Request(request, { body });
        }
        return request;
      })
      .build(fetchImplementation);
  }

  send(context: Value.Struct, name: string, message?: Value.Struct): void {
    this.writeQueue.push({
      eventDefinition: name,
      eventTime: new Date().toISOString(),
      payload: { ...context, ...message },
    });
    this.clearPendingFlush();
    if (this.writeQueue.length >= this.maxBatchSize) {
      this.flush();
    } else {
      if (this.flushTimeoutMilliseconds > 0) {
        this.pendingFlush = setTimeout(() => {
          this.flush();
        }, this.flushTimeoutMilliseconds);
      }
    }
  }

  public flush(): Promise<boolean> {
    this.clearPendingFlush();
    const batchSize = this.writeQueue.length;
    if (batchSize === 0) {
      return Promise.resolve(true);
    }
    return this.upload({
      clientSecret: this.clientSecret,
      sendTime: new Date().toISOString(),
      events: this.writeQueue.splice(0, this.maxBatchSize),
    })
      .then(errors => {
        if (errors.length === 0) {
          this.logger.info?.('Confidence: successfully uploaded %i events', batchSize);
          return true;
        }
        const distinctErrorMessages = Array.from(new Set(errors.map(({ reason, message }) => message || reason)));
        this.logger.warn?.(
          'Confidence: failed to upload %i out of %i event(s) with the following errors: %o',
          errors.length,
          batchSize,
          distinctErrorMessages,
        );
        return false;
      })
      .catch(error => {
        this.logger.error?.('Confidence: failed to upload %i events.', batchSize, error);
        return false;
      });
  }

  public clearPendingFlush(): void {
    if (this.pendingFlush) {
      clearTimeout(this.pendingFlush);
      this.pendingFlush = undefined;
    }
  }

  // Made public for unit testing
  public upload(batch: EventBatch): Promise<PublishError[]> {
    return this.fetchImplementation(this.publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...batch,
        events: batch.events.map(e => ({ ...e, eventDefinition: `eventDefinitions/${e.eventDefinition}` })),
      }),
    })
      .then(resp => resp.json())
      .then(({ errors }) => errors);
  }
}
