import { FlagResolverClient } from './FlagResolverClient';
import { EventSenderEngine } from './EventSenderEngine';
import { Value } from './Value';
import { EventSender } from './events';
import { Context } from './context';
import { Logger } from './logger';
import { FlagEvaluation, FlagResolution, FlagResolver, PendingFlagResolution } from './flags';
import { SdkId } from './generated/confidence/flags/resolver/v1/types';
import { visitorIdentity } from './trackers';
import { Trackable } from './Trackable';
import { Closer } from './Closer';
import { Subscribe, Observer, subject } from './observing';

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
  readonly logger: Logger;
  readonly timeout: number;
  /** @internal */
  readonly eventSenderEngine: EventSenderEngine;
  /** @internal */
  readonly flagResolverClient: FlagResolverClient;
}

export class Confidence implements EventSender, Trackable, FlagResolver {
  readonly config: Configuration;
  private readonly parent?: Confidence;
  private _context: Map<string, Value> = new Map();
  private contextChanged?: Observer<string[]>;

  /** @internal */
  readonly contextChanges: Subscribe<string[]>;

  private flagResolution?: PendingFlagResolution;

  constructor(config: Configuration, parent?: Confidence) {
    this.config = config;
    this.parent = parent;
    this.contextChanges = subject(observer => {
      let parentSubscription: Closer | void;
      if (parent) {
        parentSubscription = parent.contextChanges(keys => {
          const visibleKeys = keys.filter(key => !this._context.has(key));
          if (visibleKeys.length) observer(visibleKeys);
        });
      }
      this.contextChanged = observer;
      return () => {
        parentSubscription?.();
        this.contextChanged = undefined;
      };
    });
  }

  get environment(): string {
    return this.config.environment;
  }

  private sendEvent(name: string, message?: Value.Struct): void {
    this.config.eventSenderEngine.send(this.getContext(), name, message);
  }

  private *contextEntries(): Iterable<[key: string, value: Value]> {
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
        yield entry;
      }
    }
  }

  getContext(): Context {
    const context: Record<string, Value> = {};
    for (const [key, value] of this.contextEntries()) {
      context[key] = value;
    }
    return Object.freeze(context);
  }

  setContext(context: Context): void {
    const current = this.getContext();
    const changedKeys: string[] = [];
    for (const key of Object.keys(context)) {
      if (Value.equal(current[key], context[key])) continue;
      changedKeys.push(key);
      this._context.set(key, Value.clone(context[key]));
    }
    if (this.contextChanged && changedKeys.length > 0) {
      this.contextChanged(changedKeys);
    }
  }

  clearContext(): void {
    const oldContext = this.getContext();
    this._context.clear();
    if (this.contextChanged) {
      const newContext = this.getContext();
      const unionKeys = Array.from(new Set([...Object.keys(oldContext), ...Object.keys(newContext)]));
      const changedKeys = unionKeys.filter(key => !Value.equal(oldContext[key], newContext[key]));
      if (changedKeys.length) this.contextChanged(changedKeys);
    }
  }

  withContext(context: Context): Confidence {
    const child = new Confidence(this.config, this);
    child.setContext(context);
    return child;
  }

  track(name: string, message?: Value.Struct): void;
  track(manager: Trackable.Manager): Closer;
  track(nameOrManager: string | Trackable.Manager, message?: Value.Struct): Closer | undefined {
    if (typeof nameOrManager === 'function') {
      return Trackable.setup(this, nameOrManager);
    }
    this.sendEvent(nameOrManager, message);
    return undefined;
  }

  resolveFlags(...flagNames: string[]): Promise<FlagResolution> {
    const timeout: Promise<never> = new Promise((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Resolve timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
    // we first resolve a promise so that if multiple context changes happen in the same tick, we still only make one resolve
    const resolve = Promise.resolve().then(() => {
      const context = this.getContext();
      if (!this.flagResolution || !Value.equal(context, this.flagResolution.context)) {
        this.flagResolution?.abort(new Error('Resolve aborted due to stale context'));
        this.flagResolution = this.config.flagResolverClient.resolve(context, flagNames);
      }
      return this.flagResolution;
    });
    return Promise.race([resolve, timeout])
      .then(resolution => {
        this.config.logger.info?.(`Confidence: successfully resolved flags`);
        return resolution;
      })
      .catch(error => {
        this.config.logger.warn?.('Confidence: failed to resolve flags', error);
        throw error;
      });
  }

  evaluateFlag<T extends Value>(path: string, defaultValue: T): Promise<FlagEvaluation<T>> {
    const [name] = path.split('.');
    return this.resolveFlags(name).then(resolution => resolution.evaluate(path, defaultValue));
  }

  getFlag<T extends Value>(path: string, defaultValue: T): Promise<T> {
    const [name] = path.split('.');
    return this.resolveFlags(name).then(resolution => resolution.evaluate(path, defaultValue).value);
  }

  static create({
    clientSecret,
    region,
    timeout,
    environment,
    fetchImplementation = defaultFetchImplementation(),
    logger = defaultLogger(),
  }: ConfidenceOptions): Confidence {
    const baseUrl = getConfidenceUrl(region);
    const sdk = {
      id: SdkId.SDK_ID_JS_CONFIDENCE,
      version: '0.0.4', // x-release-please-version
    } as const;
    const flagResolverClient = new FlagResolverClient({
      clientSecret,
      baseUrl,
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
      fetchImplementation,
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
      eventSenderEngine,
      timeout,
      logger,
    });
    if (environment === 'client') {
      root.track(visitorIdentity());
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

function defaultLogger(): Logger {
  try {
    if (process.env.NODE_ENV === 'development') {
      return Logger.withLevel(console, 'info');
    }
  } catch (e) {
    // ignore
  }
  return Logger.noOp();
}

function getConfidenceUrl(region?: 'eu' | 'us' | 'global'): string {
  if (region === 'global' || !region) {
    return 'https://resolver.confidence.dev/v1';
  }
  return `https://resolver.${region}.confidence.dev/v1`;
}
