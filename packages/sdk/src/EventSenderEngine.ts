import { Value } from './Value';
import { FetchBuilder, TimeUnit } from '@spotify-confidence/client-http';
interface Event {
  name: string,
  eventTime: string,
  payload: Value.Struct
}

interface EventBatch {
  sendTime: string,
  clientSecret: string,
  events: Event[]
}

export interface EventSenderEngineOptions {
  clientSecret: string,
  maxBatchSize: number,
  flushIntervalDuration: number,
  fetchImplementation: FetchImplementation,
  region: 'eu' | 'us',
}

type FetchImplementation = typeof fetch;

export class EventSenderEngine {
  private readonly writeQueue: Event[] = []
  private readonly intervalId: ReturnType<typeof setInterval>;
  private readonly clientSecret: string;
  private readonly maxBatchSize: number;
  private readonly fetchImplementation: FetchImplementation;
  private readonly region: string;

  constructor({clientSecret, maxBatchSize, flushIntervalDuration, fetchImplementation, region}: EventSenderEngineOptions) {
    this.region = region;
    this.clientSecret = clientSecret;
    this.maxBatchSize = maxBatchSize;
    this.fetchImplementation = new FetchBuilder()
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

    this.intervalId = setInterval(() => {
        this.flush();
      }, flushIntervalDuration);
  }
  send(name: string, message: Value.Struct | undefined, context: Value.Struct): void {
    this.writeQueue.push({name, eventTime: new Date().toISOString(), payload: {...message, context}})
    if(this.writeQueue.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  private flush() {
      this.upload({
        clientSecret: this.clientSecret,
        sendTime: new Date().toISOString(),
        events: this.writeQueue.splice(0, this.maxBatchSize),
      });
  }

  private upload(_batch: EventBatch): void {
    this.fetchImplementation(
      this.getEventsUrl(this.region),
      {method: "POST", body:JSON.stringify(_batch)}
      )
  }

  private getEventsUrl(region: string) {
    if (region === 'global' || !region) {
      return 'https://events.confidence.dev/v1/events:publish';
    }
    return `https://events.${this.region}.confidence.dev/v1/events:publish`;
  }

  shutdown(): void {
    clearInterval(this.intervalId);
  }
}

