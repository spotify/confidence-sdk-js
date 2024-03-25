import { Value } from './Value';
import { FetchBuilder, TimeUnit } from '@spotify-confidence/client-http';
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
}

type FetchImplementation = typeof fetch;

export class EventSenderEngine {
  private readonly writeQueue: Event[] = [];
  private readonly flushTimeoutMilliseconds: number;
  private readonly clientSecret: string;
  private readonly maxBatchSize: number;
  private readonly fetchImplementation: FetchImplementation;
  private readonly publishUrl: string;
  private pendingFlush: undefined | ReturnType<typeof setTimeout>;

  constructor({
    clientSecret,
    maxBatchSize,
    flushTimeoutMilliseconds,
    fetchImplementation,
    region,
    rateLimitRps,
  }: EventSenderEngineOptions) {
    this.publishUrl = `https://events.${region}.confidence.dev/v1/events:publish`;
    this.clientSecret = clientSecret;
    this.maxBatchSize = maxBatchSize;
    this.flushTimeoutMilliseconds = flushTimeoutMilliseconds;
    const fetchBuilder = new FetchBuilder()
      .limitPending(1000)
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
      eventDefinition: `eventDefinitions/${name}`,
      eventTime: new Date().toISOString(),
      payload: { ...message, ...context },
    });
    if (this.pendingFlush) {
      clearTimeout(this.pendingFlush);
    }
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
    if (this.writeQueue.length === 0) {
      return Promise.resolve(true);
    }
    return this.upload({
      clientSecret: this.clientSecret,
      sendTime: new Date().toISOString(),
      events: this.writeQueue.splice(0, this.maxBatchSize),
    })
      .then(errors => errors.length === 0)
      .catch(_error => false);
  }

  private upload(batch: EventBatch): Promise<PublishError[]> {
    return this.fetchImplementation(this.publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })
      .then(resp => resp.json())
      .then(({ errors }) => errors);
  }
}
