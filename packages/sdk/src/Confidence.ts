import { FlagResolverClient, FlagResolution } from './FlagResolverClient';
import { EventSenderEngine } from './EventSenderEngine';
import { Value } from './Value';
import { EventSender, EventProducer, Destructor } from './events';
import { Context, LazyContext } from './context';
import { Logger } from './logger';
import { visitorId } from './producers';

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
  readonly logger: Logger;
}

type ValueProvider = () => Value | Promise<Value>;
type OnCloseListener = () => void;
export class Confidence implements EventSender {
  private readonly config: Configuration;
  private readonly parent?: Confidence;
  private readonly onCloseListeners = new Set<OnCloseListener>();
  private _context: Map<string, ValueProvider | undefined> = new Map();
  private closed = false;

  constructor(config: Configuration, parent?: Confidence) {
    this.config = config;
    this.parent = parent;
    if (parent) {
      // TODO this creates a reference from parent to child, it might be problematic and should at least be cleaned up on close
      parent.onClose(this.close.bind(this));
    }
  }

  get environment(): string {
    return this.config.environment;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  private assertOpen() {
    if (this.closed) throw new Error('Confidence instance is closed.');
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
        const value = await provider();
        if (typeof value !== 'undefined') {
          context[key] = value;
        }
      } catch (e) {
        this.config.logger.error?.('Error getting context for key', key, e);
      }
    }
    return Object.freeze(context);
  }

  setContext(context: LazyContext): void {
    for (const key of Object.keys(context)) {
      this.updateContextEntry(key, context[key]);
    }
  }

  updateContextEntry<K extends string>(name: K, value: LazyContext[K]) {
    let provider: ValueProvider;
    if (typeof value === 'function') {
      // TODO consider cloning the value of the provider before returning it
      provider = value;
    } else {
      const copy = Value.clone(value);
      provider = () => copy;
    }
    this._context.set(name, provider);
  }

  clearContext(): void {
    this._context.clear();
  }

  withContext(context: LazyContext): Confidence {
    const child = new Confidence(this.config, this);
    child.setContext(context);
    return child;
  }

  async sendEvent(name: string, message?: Value.Struct) {
    if (this.closed) {
      this.config.logger.warn?.('Confidence instance is closed. Event not sent.');
      return;
    }
    this.config.eventSenderEngine.send(await this.getContext(), name, message);
  }

  track(producer: EventProducer): Destructor {
    if (this.closed) {
      this.config.logger.warn?.('Confidence instance is closed. Cannot track.');
    } else {
      const destructor = producer(this);
      if (destructor) {
        let destructorCalled = false;
        const destroyOnce = () => {
          if (destructorCalled) return;
          destructorCalled = true;
          this.onCloseListeners.delete(destroyOnce);
          destructor();
        };
        this.onCloseListeners.add(destroyOnce);
        return destroyOnce;
      }
    }
    return () => {};
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const listener of this.onCloseListeners) {
      try {
        listener();
      } catch (e) {
        this.config.logger.error?.('Error calling onClose listener', e);
      }
    }
    this.onCloseListeners.clear();
  }

  /**
   * @internal
   */
  onClose(listener: OnCloseListener): void {
    if (this.closed) {
      try {
        listener();
      } catch (e) {
        this.config.logger.error?.('Error calling onClose listener', e);
      }
    } else {
      this.onCloseListeners.add(listener);
    }
  }

  /**
   * @internal
   */
  async resolve(flagNames: string[]): Promise<FlagResolution> {
    this.assertOpen();
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
    const root = new Confidence({
      environment: environment,
      flagResolverClient,
      eventSenderEngine: eventSenderEngine,
      logger,
    });
    if (environment === 'client') {
      root.updateContextEntry('visitor_id', visitorId);
    }
    return root;
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
