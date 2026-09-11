# Migrating to the thin-client providers

The remote OpenFeature providers now use `ConfidenceClient` and `FlagBundle`
instead of the stateful `Confidence` API. Upgrade the SDK and providers together.
The thin-client API was introduced for SDK `0.4.0`; the legacy API removal targets
SDK `0.5.0`. Both providers require
`@spotify-confidence/sdk >=0.4.0 <0.6.0`. OpenFeature peer ranges are
`@openfeature/web-sdk >=1.3.2 <2` and `@openfeature/server-sdk >=1.16.0 <2`.

The stateful `Confidence` class and `@spotify-confidence/react` integration have
been removed, including their context observers, cache, trackers, and Next.js
development patch. The separate local resolver provider is not based on this
thin client.

## Replacing the Confidence API

The SDK now exports `ConfidenceClient`, `FlagBundle`, `EvaluationContext`, logger
types, and `publishFlagEvaluation`. It no longer exports `Confidence`,
`ConfidenceOptions`, `Value`, `FlagEvaluation`, `FlagResolver`, `Trackable`,
`Closer`, `CacheOptions`, `CacheScope`, `SimpleFetch`, or the automatic trackers.

| Removed API                                            | Replacement                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `Confidence.create(options)`                           | `new ConfidenceClient({ clientSecret, region, fetch, logger })`                           |
| `setContext`, `withContext`, and context subscriptions | Pass an explicit context to each `resolve`, or use OpenFeature context APIs               |
| `getFlag`, `evaluateFlag`                              | `await client.resolve(...)`, then `FlagBundle.evaluate(bundle, key, defaultValue)`        |
| `track(name, data)`                                    | `await client.publish({ name, payload: { ...data, context } })`, or OpenFeature `track()` |
| `Value` and `FlagEvaluation` types                     | `FlagBundle.Value` and `FlagBundle.Details<T>`                                            |
| Cached flag state and observers                        | Store bundles in the application, or use the web provider                                 |
| `pageViews`, `visitorId`, and `webVitals` trackers     | Application-managed identity and event collection                                         |
| `close()` and `waitUntil`                              | Await thin-client writes, or drain the provider at shutdown                               |

For example, replace a context-scoped flag read with:

```ts
import { ConfidenceClient, FlagBundle } from '@spotify-confidence/sdk';

const client = new ConfidenceClient({ clientSecret: 'your-client-secret' });
const bundle = await client.resolve(['checkout'], { targeting_key: 'user-1' }, { signal: AbortSignal.timeout(1000) });
const { value } = FlagBundle.evaluate(bundle, 'checkout.enabled', false);
```

The retired React hooks are not replaced in this change. Applications can consume
bundles through their own React context, or use OpenFeature's React integration
with the web provider. Existing installations of the legacy React package must
remain on a compatible older SDK until migrated; they cannot use this SDK release.

## Construct providers from configuration

Provider factories no longer accept a `Confidence` instance. Replace
`createConfidenceWebProvider(confidence)` or
`createConfidenceServerProvider(confidence)` with explicit options:

```ts
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';

const provider = createConfidenceWebProvider({
  clientSecret: 'your-client-secret',
  timeout: 1000,
  region: 'eu',
  logger: console,
});
```

The server factory takes the same options. Only the web factory accepts
`applyDebounce` (default 10ms). If constructing provider classes directly, pass a
`ConfidenceClient` and a second argument containing `{ timeout: 1000 }`;
the web constructor also accepts `applyDebounce` there.

## Context and exposure

- Pass OpenFeature context using `targetingKey`. The providers translate it to
  `targeting_key`; direct thin-client calls use `targeting_key` already.
- On the web, await `OpenFeature.setContext(context)` to finish reconciliation
  before using the new assignments. Flags are evaluated synchronously from the
  current bundle, and exposure is batched when they are accessed.
- On the server, pass request-specific context to each evaluation. Each call
  resolves and applies the requested flag; there is no SDK flag cache.
- Configuration from a previous `Confidence` instance is not inherited. Its
  cache settings, automatic trackers, and configurable apply mode are not
  provider options. Web providers use access apply; server providers use backend
  apply.

## Custom endpoints

`resolveBaseUrl` and `applyBaseUrl` are no longer provider options. Use `region`
for the Confidence EU or US services. For custom routing, supply a
fetch-compatible `fetchImplementation` to the provider or `fetch` to the thin
client. The transport must honor `AbortSignal` for request deadlines to work.

Route by destination: flag resolution and exposure go to the resolver service,
while tracking goes to the separate events service. For example, to route only
flag operations through a Cloudflare service binding:

```ts
import { createConfidenceServerProvider } from '@spotify-confidence/openfeature-server-provider';

const provider = createConfidenceServerProvider({
  clientSecret: 'your-client-secret',
  timeout: 1000,
  fetchImplementation: (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    return url.hostname === 'resolver.confidence.dev' ? env.RESOLVER.fetch(input, init) : globalThis.fetch(input, init);
  },
});
```

This example runs in a Worker, where `env.RESOLVER` is supplied by the application.
For a regional client, match its regional resolver hostname instead. Wrap a
binding's `fetch` method to preserve its receiver.

## Event tracking and shutdown

Use OpenFeature's `client.track()` to publish an event. Attribution uses the
effective evaluation context; a `context` key in tracking details cannot replace
it. Events are sent immediately, without queuing or automatic retries. Errors
are reported to the configured logger because `track()` returns `void`.

The provider's `timeout` now bounds write requests as well as resolves. Web
exposure has one automatic retry after 250ms for transport errors, timeouts,
HTTP 429, or HTTP 5xx. Event publishing does not retry because delivery may have
succeeded even if its response was lost.

Await `OpenFeature.clearProviders()` at application shutdown to drain writes.
Do not clear a shared server provider after every request. Request-scoped
runtimes must keep pending writes alive through their own lifecycle mechanism.
Small writes use keepalive, and web exposure flushes on visibility loss/page hide;
neither mechanism guarantees delivery if the browser quota or network prevents it.

## Direct ConfidenceClient changes

| Previous API                   | Current API                                          |
| ------------------------------ | ---------------------------------------------------- |
| `Options.flagClientSecret`     | `Options.clientSecret`                               |
| `Options.url`                  | `Options.region`, or routing through `Options.fetch` |
| `ConfidenceClient.ApplyResult` | `ConfidenceClient.WriteResult`                       |

`resolve`, `apply`, and the new `publish` method report failures as values. The
client itself does not retry, cache, or batch calls; provider-level batching and
retry behavior is separate. Await writes directly when using the thin client,
which has no `close()` method.
