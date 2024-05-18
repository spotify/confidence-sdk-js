import { FlagResolution, FlagResolverClient, PendingResolution } from './FlagResolverClient';
import { EventSenderEngine } from './EventSenderEngine';
import { Value } from './Value';
import { EventSender } from './events';
import { Context } from './context';
import { Logger } from './logger';
import { FlagEvaluation, FlagResolver, FlagState, FlagStateObserver } from './flags';
import { SdkId } from './generated/confidence/flags/resolver/v1/types';
import { visitorIdentity } from './trackers';
import { Trackable } from './Trackable';
import { Closer } from './Closer';
import { Subscribe, Observer, subject, changeObserver } from './observing';
// import { MultiSet } from './utils';

const NO_OP_FN = () => {};
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

  private currentFlags?: FlagResolution;
  private pendingFlags?: PendingResolution;

  // private allFlagsSubscriptions = 0;
  // private readonly flagNameSubscriptions = new MultiSet<string>();
  private readonly flagStateSubject: Subscribe<FlagState>;

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

    this.flagStateSubject = subject(observer => {
      if (!this.currentFlags || !Value.equal(this.currentFlags.context, this.getContext())) {
        this.resolveFlags().then(observer);
      }
      const close = this.contextChanges(() => {
        if (this.flagState === 'READY') observer('STALE');
        this.resolveFlags().then(observer);
      });

      return () => {
        close();
        // this.pendingFlags?.abort();
        // this.pendingFlags = this.currentFlags = undefined;
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

  async resolveFlags(...flagNames: string[]): Promise<FlagState> {
    // TODO abort reason
    // TODO how to resolve previous calls?
    await Promise.resolve();
    const context = this.getContext();
    if (this.pendingFlags && !Value.equal(this.pendingFlags.context, context)) {
      this.pendingFlags.abort(new Error('Context changed'));
      this.pendingFlags = undefined;
    }
    if (!this.pendingFlags) {
      this.pendingFlags = this.config.flagResolverClient.resolve(context, flagNames);
    }
    return this.pendingFlags
      .then<FlagState>(resolution => {
        this.currentFlags = resolution;
        this.pendingFlags = undefined;
        return 'READY';
      })
      .catch(e => {
        if (e.message === 'Context changed') return this.flagState;
        this.config.logger.info?.('Resolve failed.', e);
        return 'ERROR';
      });
  }

  get flagState(): FlagState {
    if (this.currentFlags) {
      if (this.pendingFlags) return 'STALE';
      return 'READY';
    }
    return 'NOT_READY';
  }

  subscribe(...flagNames: string[]): () => void;
  subscribe(...args: [...flagNames: string[], onStateChange: FlagStateObserver]): () => void;
  subscribe(...args: any[]): () => void {
    const flagNames: string[] = [];
    let onStateChange: FlagStateObserver | undefined;
    for (const arg of args) {
      if (typeof arg === 'string') {
        flagNames.push(arg);
      } else if (typeof arg === 'function') {
        if (onStateChange) throw new Error('Only one onStateChange observer can be provided');
        onStateChange = changeObserver(arg);
      } else {
        throw new Error('Unknown argument type');
      }
    }
    // if (flagNames.length === 0) {
    //   this.allFlagsSubscriptions++;
    // } else {
    //   flagNames.forEach(flagName => this.flagNameSubscriptions.add(flagName));
    // }
    const close = this.flagStateSubject(onStateChange || NO_OP_FN);
    onStateChange?.(this.flagState);
    return () => {
      close();
      // if (flagNames.length === 0) {
      //   this.allFlagsSubscriptions--;
      // } else {
      //   flagNames.forEach(flagName => this.flagNameSubscriptions.delete(flagName));
      // }
    };
  }

  evaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
    const [flagName] = path.split('.');
    let evaluation: FlagEvaluation<T>;
    if (!this.currentFlags) {
      evaluation = {
        reason: 'ERROR',
        errorCode: 'PROVIDER_NOT_READY',
        errorMessage: 'Provider is not yet ready',
        value: defaultValue,
      };
      if (!this.pendingFlags) this.resolveFlags(flagName);
    } else {
      evaluation = this.currentFlags.evaluate(path, defaultValue);
    }
    if (!this.currentFlags || !Value.equal(this.currentFlags.context, this.getContext())) {
      // evaluation.stale = true;
      const then: PromiseLike<FlagEvaluation.Resolved<T>>['then'] = (onfulfilled?, onrejected?) => {
        const p: Promise<FlagEvaluation.Resolved<T>> = new Promise(resolve => {
          const close = this.subscribe(flagName, state => {
            if (state === 'READY') {
              close();
              resolve(this.currentFlags!.evaluate(path, defaultValue));
            }
          });
        });

        return p.then(onfulfilled, onrejected);
      };
      return Object.assign(evaluation, { then });
    }
    return evaluation;
  }

  async getFlag<T extends Value>(path: string, defaultValue: T): Promise<T> {
    return (await this.evaluateFlag(path, defaultValue)).value;
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
      version: '0.0.5', // x-release-please-version
    } as const;
    const flagResolverClient = new FlagResolverClient({
      clientSecret,
      baseUrl,
      fetchImplementation,
      sdk,
      environment,
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

// class FailedResolution implements FlagResolution {
//   readonly resolveToken = '';

//   constructor(
//     readonly context: Value.Struct,
//     private readonly errorCode: FlagEvaluation.Failed<unknown>['errorCode'],
//     private readonly errorMessage: string,
//   ) {}
//   evaluate<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
//     return {
//       reason: 'ERROR',
//       value: defaultValue,
//       errorCode: this.errorCode,
//       errorMessage: this.errorMessage,
//     };
//   }
// }
