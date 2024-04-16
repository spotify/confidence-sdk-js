import { FlagResolverClient, FlagResolution } from './FlagResolverClient';
import { EventSenderEngine } from './EventSenderEngine';
import { Value } from './Value';
import { EventSender, Producer } from './events';
import { Context, ContextProvider } from './context';
import { Logger } from './logger';

export { FlagResolverClient, FlagResolution };

export interface ConfidenceOptions {
  clientSecret: string;
  region?: 'global' | 'eu' | 'us';
  baseUrl?: string;
  environment: 'client' | 'backend';
  fetchImplementation?: typeof fetch;
  timeout: number;
  logger?: Logger;
}

interface Configuration {
  readonly environment: 'client' | 'backend';
  readonly eventSenderEngine: EventSenderEngine;
  readonly flagResolverClient: FlagResolverClient;
}

type ValueProvider = () => Value | Promise<Value>

export class Confidence implements EventSender {
  private readonly config: Configuration;
  private readonly parent?: Confidence;
  private _context: Map<string, ValueProvider | undefined> = new Map();

  constructor(config: Configuration, parent?: Confidence) {
    this.config = config;
    this.parent = parent;
  }

  get environment(): string {
    return this.config.environment;
  }

  private *contextEntries(): Iterable<[key: string, value: ValueProvider]> {
    if (this.parent) {
      // all parent entries except the ones child also has
      for (const entry of this.parent.contextEntries()) {
        if (!this._context.has(entry[0])) {
          yield entry;
        }
      }
    }
    // all child entries except undefined
    for (const entry of this._context.entries()) {
      if (typeof entry[1] !== 'undefined') {
        // this cast is necessary cause TS doesn't track that the check above ensures the provider isn't undefined 
        yield entry as [string, ValueProvider];
      }
    }
  }

  async getContext(): Promise<Context> {
    const context: Record<string, Value> = {};
    for (const [key, provider] of this.contextEntries()) {
      try {
        const value  = await provider();
        if(typeof value !== 'undefined'){
          context[key] = value;
        }
      }
      catch(e) {
        // TODO log provider error
      }
    }
    return Object.freeze(context);
  }

  setContext(context: Context): void {
    for (const key of Object.keys(context)) {
      this.updateContextEntry(key, context[key]);
    }
  }

  updateContextEntry<K extends string>(name: K, value: Context[K] | ContextProvider<K>) {
    let provider:ValueProvider;
    if(typeof value === 'function') {
      // TODO consider cloning the value of the provider before returning it
      provider = value;
    } else {
      const copy = Value.clone(value);
      provider = () => copy;
    }
    this._context.set(name, provider);
  }

  removeContextEntry(name: string): void {
    this._context.set(name, undefined);
  }

  clearContext(): void {
    this._context.clear();
  }

  withContext(context: Context): Confidence {
    const child = new Confidence(this.config, this);
    child.setContext(context);
    return child;
  }

  async sendEvent(name: string, message?: Value.Struct) {
    this.config.eventSenderEngine.send(await this.getContext(), name, message);
  }

  track(producer: Producer): void {
    this.runProducer(producer).catch(_e => {
      // TODO log  error
    })
  }

  private async runProducer(producer:Producer):Promise<void> {
    for await(const event of producer) {
      const { context, ...events } = event;
      if(event.context) {
        this.setContext(event.context);
      }
      for(const name of Object.keys(events)) {
        this.sendEvent(name, event[name]);
      }
    }
  }

  /**
   * @internal
   */
  async resolve(flagNames: string[]): Promise<FlagResolution> {
    return this.config.flagResolverClient.resolve(await this.getContext(), flagNames);
  }

  /**
   * @internal
   */
  apply(resolveToken: string, flagName: string): void {
    this.config.flagResolverClient.apply(resolveToken, flagName);
  }

  static create({
    clientSecret,
    region,
    baseUrl,
    timeout,
    environment,
    fetchImplementation = defaultFetchImplementation(),
    logger = Logger.noOp(),
  }: ConfidenceOptions): Confidence {
    const sdk = {
      id: 'SDK_ID_JS_CONFIDENCE',
      version: '0.0.2', // x-release-please-version
    } as const;
    const flagResolverClient = new FlagResolverClient({
      clientSecret,
      region,
      baseUrl,
      timeout,
      environment,
      fetchImplementation,
      sdk,
    });
    const estEventSizeKb = 1;
    const flushTimeoutMilliseconds = 500;
    // default grpc payload limit is 4MB, so we aim for a 1MB batch-size
    const maxBatchSize = Math.floor(1024 / estEventSizeKb);
    const eventSenderEngine = new EventSenderEngine({
      clientSecret,
      maxBatchSize,
      flushTimeoutMilliseconds,
      fetchImplementation: fetchImplementation,
      region: nonGlobalRegion(region),
      // we set rate limit to support the flushTimeout
      // on backend, the rate limit would be ∞
      rateLimitRps: environment === 'client' ? 1000 / flushTimeoutMilliseconds : Number.POSITIVE_INFINITY,
      // the request is queued or in flight in memory to be sent.
      // max memory consumption is 50MB
      maxOpenRequests: (50 * 1024) / (estEventSizeKb * maxBatchSize),
      logger,
    });
    return new Confidence({
      environment: environment,
      flagResolverClient,
      eventSenderEngine: eventSenderEngine,
    });
  }
}

function defaultFetchImplementation(): typeof fetch {
  if (!globalThis.fetch) {
    throw new TypeError(
      'No default fetch implementation found. Please provide provide the fetchImplementation option to createConfidenceWebProvider.',
    );
  }
  return globalThis.fetch.bind(globalThis);
}

function nonGlobalRegion(region: 'eu' | 'us' | 'global' = 'eu'): 'eu' | 'us' {
  return region === 'global' ? 'eu' : region;
}
