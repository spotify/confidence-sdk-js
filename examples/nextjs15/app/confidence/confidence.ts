import { AccessiblePromise } from './AccessiblePromise';

export type Context = Record<string, any>;

export type Flags = Record<string, any>;

export type Cache = Record<string, AccessiblePromise<Flags>>;

const kClientRegistry: unique symbol = Symbol.for('condifence.clientRegistry');

const CLIENT_REGISTRY = (globalThis as any)[kClientRegistry]
  ? (globalThis as any)[kClientRegistry]
  : ((globalThis as any)[kClientRegistry] = new Map<string, Configuration>());

export type ConfigurationFactory = (options: ConfidenceOptions) => Configuration;
export type ConfigurationMiddleware = (next: ConfigurationFactory) => ConfigurationFactory;

let configurationFactory: ConfigurationFactory = options => ({
  flagResolver: ctx => fetchFlags(ctx),
});

export function addConfigurationMiddleware(middleware: ConfigurationMiddleware) {
  const next = configurationFactory;
  configurationFactory = middleware(next);
}

export type Configuration = {
  id?: string;
  cache?: Cache;
  flagResolver: (context: Context) => PromiseLike<Flags>;
  // flagApplier
};

function configurationRegistry(next: ConfigurationFactory): ConfigurationFactory {
  return options => {
    const id = JSON.stringify(options);

    let configuration = CLIENT_REGISTRY.get(id);
    if (!configuration) {
      configuration = next(options);
      configuration.id = id;
      CLIENT_REGISTRY.set(id, configuration);
    }
    return configuration;
  };
}

export function getConfiguration(id: string): Configuration | undefined {
  return CLIENT_REGISTRY.get(id);
}

addConfigurationMiddleware(configurationRegistry);

export type ConfidenceOptions = {
  clientSecret: string;
};
export class Confidence {
  readonly configuration: Configuration;
  private readonly onChangeListeners = new Set<() => void>();
  private context: Context = {};
  private flags: AccessiblePromise<Flags> | undefined;

  constructor(configuration: Configuration, context: Context, parent?: Confidence) {
    this.configuration = configuration;
    this.context = { ...parent?.context, ...context };
    this.resolve();
  }

  setContext(ctx: Context) {
    this.context = ctx;
    this.resolve();
  }

  getContext(): Context {
    return this.context;
  }

  withContext(context: Context) {
    const child = new Confidence(this.configuration, this.context);
    child.setContext(context);
    return child;
  }
  getFlag<T>(name: string, defaultValue: T): AccessiblePromise<T> {
    return this.flags!.then(flags => (flags[name] as T) ?? defaultValue);
  }

  subscribe(onChange: () => void): () => void {
    this.onChangeListeners.add(onChange);
    onChange();
    return () => {
      this.onChangeListeners.delete(onChange);
    };
  }

  toJSON() {
    return { ...this };
  }

  private resolve(): void {
    this.flags = AccessiblePromise.resolve(this.configuration.flagResolver(this.context));
    this.flags.then(() => {
      this.onChangeListeners.forEach(listener => listener());
    });
  }

  static create(options: ConfidenceOptions): Confidence {
    return new Confidence(configurationFactory(options), {});
  }
}

async function fetchFlags(ctx: Context): Promise<Flags> {
  console.log('fetchFlags', ctx);
  // debugger;
  await sleep(1000);
  if (typeof ctx.role === 'string') {
    if (ctx.role === 'admin') {
      return {
        pantsColor: 'blue',
      };
    }
    return {
      pantsColor: 'red',
    };
  }
  return {};
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isServer(): boolean {
  return typeof window === 'undefined';
}
