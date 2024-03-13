import { FlagResolverClient, FlagResolution, ApplyManager } from './flags';
import { EventSenderEngine } from './EventSenderEngine';
import { Value } from './Value';

export { FlagResolverClient, FlagResolution };

const APPLY_TIMEOUT = 250;
const MAX_APPLY_BUFFER_SIZE = 20;

export interface EventSender extends Contextual {
  sendEvent(name: string, message?: Value): void;
}

export interface Context extends Value.Struct {
  openFeature?: {
    targeting_key?: string;
  };
}
export interface Contextual {
  context(): Context;
  put<K extends string>(name: K, value: Context[K]): void;
  remove(name: string): void;
}

export interface ConfidenceOptions {
  clientSecret: string;
  region?: 'global' | 'eu' | 'us';
  baseUrl?: string;
  environment: 'client' | 'backend';
  fetchImplementation?: typeof fetch;
  timeout: number;
}

interface Configuration {
  readonly environment: 'client' | 'backend';
  readonly eventSenderEngine: EventSenderEngine;
  readonly flagResolverClient: FlagResolverClient;
  readonly applyManager: ApplyManager;
}

export class Confidence implements EventSender {
  private readonly config: Configuration;
  private _context: Map<string, Value> = new Map();

  constructor(config: Configuration) {
    this.config = config;
  }

  get environment(): string {
    return this.config.environment;
  }

  sendEvent(name: string, message?: Value) {
    this.config.eventSenderEngine.send(name, message, this.context());
  }
  context(): Context {
    const context: Record<string, Value> = {};
    for (const [key, value] of this._context) {
      context[key] = value;
    }
    return Object.freeze(context);
  }
  put<K extends string>(name: K, value: Context[K]) {
    this._context.set(name, Value.clone(value));
  }
  remove(name: string) {
    this._context.delete(name);
  }
  /**
   * @internal
   */
  resolve(flagNames: string[]): Promise<FlagResolution> {
    // todo evaluationContext should be the whole context, but for now we take just the openFeature context to not break e2e tests
    const evaluationContext: Value.Struct = (this._context.get('openFeature') || {}) as Value.Struct;
    return this.config.flagResolverClient.resolve(evaluationContext, { apply: false, flags: flagNames });
  }

  /**
   * @internal
   */
  apply(resolveToken: string, flagName: string): void {
    this.config.applyManager.apply(resolveToken, flagName);
  }

  static create(options: ConfidenceOptions): Confidence {
    const sdk = {
      id: 'SDK_ID_JS_WEB_PROVIDER',
      version: '0.0.1-total-confidence',
    } as const;
    const fetchImplementation = options.fetchImplementation || defaultFetchImplementation();
    const flagResolverClient = new FlagResolverClient({
      clientSecret: options.clientSecret,
      region: options.region,
      baseUrl: options.baseUrl,
      timeout: options.timeout,
      apply: options.environment == 'backend',
      environment: options.environment,
      fetchImplementation,
      sdk,
    });
    return new Confidence({
      environment: options.environment,
      flagResolverClient,
      eventSenderEngine: new EventSenderEngine(),
      applyManager: new ApplyManager({
        client: flagResolverClient,
        timeout: APPLY_TIMEOUT,
        maxBufferSize: MAX_APPLY_BUFFER_SIZE,
      }),
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
