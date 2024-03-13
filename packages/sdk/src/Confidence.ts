import { FlagResolution, FlagResolverClient } from './flags';
import { EventSenderEngine } from './EventSenderEngine';
import { Value } from './Value';

export interface EventSender extends Contextual {
  sendEvent(name: string, message?: Value): void;
}

export interface Contextual {
  context(): Value.Struct;
  put(name: string, value: Value): void;
  remove(name: string): void;
}

export interface ConfidenceOptions {
  region?: 'global' | 'eu' | 'us';
  fetchImplementation?: typeof fetch;
  clientSecret: string;
  baseUrl?: string;
  stack: 'client' | 'backend';
  timeout: number;
}

interface Configuration {
  readonly eventSenderEngine: EventSenderEngine;
  readonly flagResolverClient: FlagResolverClient;
}

export class Confidence implements EventSender {
  private readonly config: Configuration;
  private _context: Map<string, Value> = new Map();
  constructor(config: Configuration) {
    this.config = config;
  }
  sendEvent(name: string, message?: Value) {
    this.config.eventSenderEngine.send(name, message, this.context());
  }
  context(): Value.Struct {
    const context: Record<string, Value> = {};
    for (const [key, value] of this._context) {
      context[key] = value;
    }
    return Object.freeze(context);
  }
  put(name: string, value: Value) {
    this._context.set(name, Value.clone(value));
  }
  remove(name: string) {
    this._context.delete(name);
  }
  resolve(flagNames: string[]): Promise<FlagResolution> {
    return this.config.flagResolverClient.resolve(this.context(), { apply: false, flags: flagNames });
  }

  static create(options: ConfidenceOptions): Confidence {
    const sdk = {
      id: 'SDK_ID_JS_WEB_PROVIDER',
      version: '0.0.1',
    } as const;
    return new Confidence({
      flagResolverClient: new FlagResolverClient({
        clientSecret: options.clientSecret,
        region: options.region,
        baseUrl: options.baseUrl,
        fetchImplementation: options.fetchImplementation || defaultFetchImplementation(),
        timeout: options.timeout,
        apply: true,
        sdk,
      }),
      eventSenderEngine: new EventSenderEngine(),
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
