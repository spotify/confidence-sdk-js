import { AccessiblePromise } from '../AccessiblePromise';
import { Context } from '../context';

export type ContextProvider = () => Promise<Context>;

/*

What are we trying to achieve here?
1. We want a single Confidence API type that knows mainly context
2. It should be possible to extend this type in a separate module, for instance with new API such as event sending.
3. Some other extensions might not change the public API but need to hook into logic to change for instance caching or retries etc.
4. Additionally we need a stateless API that can be used server side, but it makes sense to also use it 
   client side and let the Confidence class be a stateful wrapper around it.
5. Additionally we need a way to serialize/deserialize state from server to client so that the client can pick up where the server left off.

Comments:
Some thoughts on extensions:
  - Extensions can enrich the prototype of the Confidence class. This also works with TS type augmentation. One problem is to initialize the extensions.
  - Another way is to have a builder to which you can add extensions/middlewares. This however forces a generic (possibly quite complex) type to be passed around.
  - A third way is to have the different extension modules export their own creation functions. This can be a bit like a mix between the first two.
    For instance the eventing module can create a Confidence instance with the events module using a static type, but it doesn't allow for composition of multiple 
    extensions (which we might not need, or actually we do. NextJS and React are orthogonal to eventing). The create functions could take a Confidence instance
    but then it becomes generic and probably just a worse variant of the builder pattern.
  - A fourth way is to explicitly add pluggable abstractions in core for the things we need to extend. So NextJS needs to affect caching, just provide a public
    cache API in the core options and let NextJS provide an implementation of that cache (but the user still needs to pass it in).
  - We could make extensions hook into only the fetch api, it'd probably cover all needs and is easy type-wise (because it's untyped duh). We'd still need to branch out
    to different fetch implementations for different endpoints like fetching flags, exposure events and generic events, at which point these might better be 
    typed async functions.
  
  For API changes I kind of like the first option. It can also be combined with a way to hook into options enrichment, as a way to initialize extensions, but also
  extensions that don't need new API can do solely that. Question is whether the enrichment should be compositional i.e. middlewares or parallel i.e. each extension sees the user options
  provides configuration only for itself. Adding caching for instance would be better served by a compositional approach but the typing and order of extensions becomes a mess.

  One additional complication is that react requires "sync promises" i.e. promises that after being fulfilled are immediately resolved. At least this is needed
  from the cache and any subsequent transformations before returning the data. We have this solved by our own promise implementation, but it's infectious, i.e.
  anything that participates in the promise chain needs to be aware and it doesn't work with async/await. This might be a motivation of making caching part of the core API.
   
*/
export interface ConfidenceOptions {
  context?: Context | ContextProvider;
}

export interface Configuration {
  context: ContextProvider;
}

export type ConfigFactory = (options: ConfidenceOptions) => Partial<Configuration>;
export type ConfigMiddleware = (next: ConfigFactory) => ConfigFactory;
export type Extension = {
  id: string;
  middleware?: ConfigMiddleware;
  factory?: ConfigFactory;
  api?: Partial<Confidence>;
};

const extensions: Extension[] = [];
const rootFactory: ConfigFactory = ({ context }) => ({
  context: normalizeContextProvider(context),
});

const middlewareReducer = (next: ConfigFactory, { middleware }: Extension) => (middleware ? middleware(next) : next);

let composedFactory = rootFactory;

// TODO we could make this typesafe by adding requires/provides to the extension object
export function addExtension({ id, middleware, factory, api }: Extension) {
  // adding extensions needs to be idempotent due to hot module reloading
  if (factory) {
    if (middleware) {
      throw new Error('Extension can only have either a factory or a middleware');
    }
    // transform factory into middleware
    middleware = next => {
      return options => {
        return { ...next(options), ...factory(options) };
      };
    };
  }
  if (api) {
    // TODO should create a completely new prototype to also support removal
    Object.assign(Confidence.prototype, api);
  }
  if (middleware) {
    const index = extensions.findIndex(ext => ext.id === id);
    if (index >= 0) {
      extensions[index] = { id, middleware };
    } else {
      extensions.push({ id, middleware });
    }
    composedFactory = extensions.reduce(middlewareReducer, rootFactory);
  }
}

export class Confidence {
  constructor(readonly config: Configuration) {}

  getContext(): Promise<Context> {
    return this.config.context();
  }

  withContext(context: Context) {
    return new Confidence({
      ...this.config,
      context: () => this.getContext().then(ctx => ({ ...ctx, ...context })),
    });
  }

  static create(options: ConfidenceOptions) {
    return new Confidence(composedFactory(options) as Configuration);
  }
}

function normalizeContextProvider(context: undefined | Context | ContextProvider): ContextProvider {
  if (context === undefined) {
    return () => AccessiblePromise.resolve({});
  }
  if (typeof context === 'object') {
    return () => AccessiblePromise.resolve(context);
  }
  return context;
}
