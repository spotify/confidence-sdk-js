import { FetchingFlagResolverClient, FlagResolverClient, PendingResolution } from './FlagResolverClient';
import { EventSenderEngine } from './EventSenderEngine';
import { Value } from './Value';
import { EventData, EventSender } from './events';
import { Context } from './context';
import { Logger } from './logger';
import { FlagEvaluation, FlagResolver, State, StateObserver } from './flags';
import { SdkId } from './generated/confidence/flags/resolver/v1/types';
import { Trackable } from './Trackable';
import { Closer } from './Closer';
import { Subscribe, Observer, subject, changeObserver } from './observing';
import { WaitUntil } from './types';
import { FlagResolution } from './FlagResolution';
import { AccessiblePromise } from './AccessiblePromise';
import { Telemetry } from './Telemetry';
import { SimpleFetch } from './fetch-util';
import { CacheOptions, CacheProvider, FlagCache } from './flag-cache';

/**
 * Confidence options, to be used for easier initialization of Confidence
 * @public
 *  */
export interface ConfidenceOptions {
  /** Client secret, to be found in Confidence console*/
  clientSecret: string;
  /** Region in which Confidence will operate */
  region?: 'eu' | 'us';
  /** Environment: can be either client of backend */
  environment: 'client' | 'backend';
  /** Fetch implementation */
  fetchImplementation?: SimpleFetch;
  /** Resolve timeout */
  timeout: number;
  /** Debug logger */
  logger?: Logger;
  /** Sets an alternative resolve url */
  resolveBaseUrl?: string;
  /** Disable telemetry */
  disableTelemetry?: boolean;
  /** Allows you to debounce the apply message. Set in ms. 0 is treated as synchronous */
  applyDebounce?: number;
  /**
   * A function that, if supplied, will be used by Confidence to register asynchronous side-effects, such as logging exposure.
   * This is particularly useful in serverless environments where you need to ensure certain operations complete before the environment is reclaimed.
   */
  waitUntil?: WaitUntil;
  /**
   * Configuration options for the Confidence SDK's flag caching system.
   * @see {@link CacheOptions}
   */
  cache?: CacheOptions;
  context?: Context;
}

/**
 * Confidence configuration
 * @internal
 */
export interface Configuration extends ConfidenceOptions {
  /** Debug logger */
  readonly logger: Logger;
  /** Event Sender Engine
   * @internal */
  readonly eventSenderEngine: EventSenderEngine;
  /** Flag Resolver Client
   * @internal */
  readonly flagResolverClient: FlagResolverClient;
  /* @internal */
  readonly clientSecret: string;
  readonly cacheProvider: CacheProvider;
}

/**
 * Class containing main Confidence APIs
 * @public
 */
export class Confidence implements EventSender, Trackable, FlagResolver {
  /** Internal Confidence configurations */
  readonly config: Configuration;
  private readonly parent?: Confidence;
  private _context: Map<string, Value>;
  private contextChanged?: Observer<string[]>;

  /**
   * Emits Closers on context change
   * @internal */
  readonly contextChanges: Subscribe<string[]>;

  private currentFlags?: FlagResolution;
  private pendingFlags?: PendingResolution<void>;

  private readonly flagStateSubject: Subscribe<State>;

  /** @internal */
  constructor({ context = {}, ...config }: Configuration, parent?: Confidence) {
    this.config = config;
    this.parent = parent;
    this._context = new Map(Object.entries(context));
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

    this.flagStateSubject = subject(observer => {
      const reportState = () => observer(this.flagState);
      if (!this.currentFlags || !Value.equal(this.currentFlags.context, this.getContext())) {
        this.resolveFlags().then(reportState);
      }
      const close = this.contextChanges(() => {
        if (this.flagState === 'READY' || this.flagState === 'ERROR') observer('STALE');
        this.resolveFlags().then(reportState);
      });

      return () => {
        close();
        this.pendingFlags?.abort();
        this.pendingFlags = undefined;
      };
    });
  }

  /** Returns currently used environment */
  get environment(): string {
    return this.config.environment;
  }

  private sendEvent(name: string, data?: EventData): void {
    this.config.eventSenderEngine.send(this.getContext(), name, data);
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

  /** Returns context of the current Confidence instance */
  getContext(): Context {
    const context: Record<string, Value> = {};
    for (const [key, value] of this.contextEntries()) {
      context[key] = value;
    }
    return Object.freeze(context);
  }

  /** Set Confidence context */
  setContext(context: Context): boolean {
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
    return changedKeys.length > 0;
  }

  /** Clears context of current Confidence instance */
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

  /**
   * Creates a new Confidence instance with context
   * @param context - Confidence context
   * @returns Confidence instance
   */
  withContext(context: Context): Confidence {
    const child = new Confidence(this.config, this);
    child.setContext(context);
    // child.resolveFlags();
    return child;
  }

  /**
   * Tracks an event
   * @param name - event name
   * @param data - data to track */
  track(name: string, data?: EventData): void;
  /**
   * Sets up a Trackable.Manager to manage event tracking or context changes.
   * @param manager - event manager
   */
  track(manager: Trackable.Manager): Closer;
  /**
   * Tracks an event
   * @param nameOrManager - event name of event manager
   * @param data - data to track
   * @returns - Closer
   */
  track(nameOrManager: string | Trackable.Manager, data?: EventData): Closer | undefined {
    if (typeof nameOrManager === 'function') {
      return Trackable.setup(this, nameOrManager);
    }
    this.sendEvent(nameOrManager, data);
    return undefined;
  }

  /** Resolves all flags in cache */
  protected resolveFlags(): AccessiblePromise<void> {
    const context = this.getContext();
    if (!this.pendingFlags || !Value.equal(this.pendingFlags.context, context)) {
      this.pendingFlags?.abort();
      this.pendingFlags = this.config.flagResolverClient
        .resolve(context, [])
        .then(resolution => {
          this.currentFlags = resolution;
        })
        .catch(e => {
          // TODO fix sloppy handling of error
          if (e.name !== 'AbortError') {
            this.config.logger.info?.('Resolve failed.', e);
          }
        })
        .finally(() => {
          // if this resolves synchronously, the assignment on 171 will actually happen after we clear it.
          this.pendingFlags = undefined;
        });
    }
    if (this.pendingFlags.status !== 'pending') {
      this.pendingFlags = undefined;
      return AccessiblePromise.resolve();
    }
    return this.pendingFlags;
  }

  /**
   * Shows flag state
   * @returns flag state - READY, NOT_READY, STALE or ERROR
   */
  get flagState(): State {
    if (this.currentFlags) {
      if (this.pendingFlags) return 'STALE';
      return this.currentFlags.state;
    }
    return 'NOT_READY';
  }

  /** Subscribe to flag changes in Confidence */
  subscribe(onStateChange: StateObserver = () => {}): () => void {
    const observer = changeObserver(onStateChange);
    const close = this.flagStateSubject(observer);
    observer(this.flagState);
    return close;
  }

  private evaluateFlagAsync<T extends Value>(path: string, defaultValue: T): Promise<FlagEvaluation.Resolved<T>> {
    let close: () => void;
    return new Promise<FlagEvaluation.Resolved<T>>(resolve => {
      close = this.subscribe(state => {
        // when state is ready we can be sure currentFlags exist
        if (state === 'READY' || state === 'ERROR') {
          resolve(this.currentFlags!.evaluate(path, defaultValue));
        }
      });
    }).finally(close!);
  }

  /** Evaluates a flag */
  evaluateFlag(path: string, defaultValue: string): FlagEvaluation<string>;
  evaluateFlag(path: string, defaultValue: boolean): FlagEvaluation<boolean>;
  evaluateFlag(path: string, defaultValue: number): FlagEvaluation<number>;
  evaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T>;
  evaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
    let evaluation: FlagEvaluation<T>;
    // resolveFlags might update state synchronously
    if (!this.currentFlags && !this.pendingFlags) this.resolveFlags();
    if (!this.currentFlags) {
      evaluation = {
        reason: 'ERROR',
        errorCode: 'NOT_READY',
        errorMessage: 'Flags are not yet ready',
        value: defaultValue,
      };
    } else {
      this.showLoggerLink(path, this.getContext());
      evaluation = this.currentFlags.evaluate(path, defaultValue);
    }
    if (!this.currentFlags || !Value.equal(this.currentFlags.context, this.getContext())) {
      const then: PromiseLike<FlagEvaluation.Resolved<T>>['then'] = (onfulfilled?, onrejected?) =>
        this.evaluateFlagAsync(path, defaultValue).then(onfulfilled, onrejected);
      const staleEvaluation = {
        ...evaluation,
        then,
      };
      return staleEvaluation;
    }
    return evaluation;
  }

  /** Returns flag value for a given flag */
  getFlag(path: string, defaultValue: string): Promise<string>;
  getFlag(path: string, defaultValue: boolean): Promise<boolean>;
  getFlag(path: string, defaultValue: number): Promise<number>;
  getFlag<T extends Value>(path: string, defaultValue: T): Promise<T>;
  async getFlag<T extends Value>(path: string, defaultValue: any): Promise<T> {
    return (await this.evaluateFlag(path, defaultValue)).value;
  }

  private showLoggerLink(flag: string, context: Context) {
    const logKey = `${flag}:${Value.serialize(context)}`;
    if (!this.config.cache?.loggedFlags?.has(logKey)) {
      this.config.cache?.loggedFlags?.add(logKey);
      this.config.logger.info?.(
        `See resolves for '${flag}' in Confidence: https://app.confidence.spotify.com/flags/resolver-test?client-key=${
          this.config.clientSecret
        }&flag=flags/${flag}&context=${encodeURIComponent(JSON.stringify(context))}`,
      );
    }
  }

  toOptions(): ConfidenceOptions {
    const cache = this.config.cacheProvider(this.config.clientSecret).toOptions();
    return {
      clientSecret: this.config.clientSecret,
      region: this.config.region,
      timeout: this.config.timeout,
      environment: this.config.environment,
      cache,
      context: this.getContext(),
    };
  }

  /**
   * Creates a Confidence instance
   * @param clientSecret - clientSecret found on the Confidence console
   * @param region - region in which Confidence will operate
   * @param timeout - timeout for flag resolves
   * @param environment - can be either "client" or "backend"
   * @param fetchImplementation - fetch implementation
   * @param logger - debug logger
   * @param resolveBaseUrl - custom backend resolve URL
   * @returns
   */
  static create(options: ConfidenceOptions): Confidence {
    const {
      clientSecret,
      region,
      timeout,
      environment,
      fetchImplementation = defaultFetchImplementation(),
      logger = defaultLogger(),
      resolveBaseUrl,
      disableTelemetry = false,
      applyDebounce = 10,
      waitUntil,
      cache = {
        loggedFlags: new Set(),
      },
    } = options;
    if (environment !== 'client' && environment !== 'backend') {
      throw new Error(`Invalid environment: ${environment}. Must be 'client' or 'backend'.`);
    }
    const sdk = {
      id: SdkId.SDK_ID_JS_CONFIDENCE,
      version: '0.3.1', // x-release-please-version
    } as const;
    const telemetry = new Telemetry({
      disabled: disableTelemetry,
      environment,
    });
    if (!clientSecret) {
      logger.error?.(`Confidence: confidence cannot be instantiated without a client secret`);
    }
    const cacheProvider = FlagCache.provider(clientSecret, cache);
    const flagResolverClient: FlagResolverClient = new FetchingFlagResolverClient({
      clientSecret,
      fetchImplementation,
      sdk,
      environment,
      resolveTimeout: timeout,
      region,
      resolveBaseUrl,
      telemetry,
      logger,
      applyDebounce,
      waitUntil,
      cacheProvider,
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
      region,
      // we set rate limit to support the flushTimeout
      // on backend, the rate limit would be ∞
      rateLimitRps: environment === 'client' ? 1000 / flushTimeoutMilliseconds : Number.POSITIVE_INFINITY,
      // the request is queued or in flight in memory to be sent.
      // max memory consumption is 50MB
      maxOpenRequests: (50 * 1024) / (estEventSizeKb * maxBatchSize),
      logger,
    });
    return new Confidence({
      ...options,
      flagResolverClient,
      eventSenderEngine,
      logger,
      cacheProvider,
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
