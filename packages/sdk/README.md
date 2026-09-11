# Confidence SDK

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

> [!NOTE]
> The standalone `Confidence` class is being phased out. For new integrations, we recommend using the OpenFeature APIs directly:
>
> - **Client-based (SPA)**: Use [@spotify-confidence/openfeature-web-provider](https://github.com/spotify/confidence-sdk-js/blob/main/packages/openfeature-web-provider/README.md)
> - **Server**: Use [@spotify-confidence/openfeature-server-provider-local](https://github.com/spotify/confidence-resolver/tree/main/openfeature-provider/js/README.md), which resolves flags in-process with close to zero latency
>
> [`ConfidenceClient`](#confidenceclient) powers this repository's remote [web](../openfeature-web-provider/README.md) and [server](../openfeature-server-provider/README.md) providers. The separate local resolver provider evaluates flags in-process and does not use this client.

JavaScript implementation of the Confidence SDK, enables event tracking and feature flagging capabilities in conjunction with the OpenFeature Web SDK.

# Usage

## Adding the dependencies

To add the packages to your dependencies run:

```sh
yarn add '@spotify-confidence/sdk@^0.4.0'
```

# ConfidenceClient

Upgrading an existing integration? See the [thin-client migration guide](../../concepts/migrate-to-thin-client.md) for renamed options, provider dependency requirements, and lifecycle changes.

`ConfidenceClient` is a thin, stateless client for a remote Confidence resolver. It does flag resolution, exposure and event publishing only — no context management, no caching, no batching.

## When to use it

Prefer a provider over calling this directly:

- **Client-side (SPA)**: [@spotify-confidence/openfeature-web-provider](https://github.com/spotify/confidence-sdk-js/blob/main/packages/openfeature-web-provider/README.md)
- **Server with remote resolution**: [@spotify-confidence/openfeature-server-provider](../openfeature-server-provider/README.md)
- **Server**: [@spotify-confidence/openfeature-server-provider-local](https://github.com/spotify/confidence-resolver/tree/main/openfeature-provider/js/README.md), which resolves in-process with close to zero latency

Reach for `ConfidenceClient` when you want the underlying primitive instead: resolving from a worker, forwarding a resolve to the browser, or anywhere a provider's lifecycle is more than you need.

There is no lifecycle, no background work and no cached state, so constructing one is free — create it per request or share it at module level, it makes no difference. There is nothing to `close()`.

```ts
import { ConfidenceClient, FlagBundle } from '@spotify-confidence/sdk';

const client = new ConfidenceClient({ clientSecret: 'my secret' });

const bundle = await client.resolve(['tutorial-feature'], { targeting_key: 'user-1' });
const { value } = FlagBundle.evaluate(bundle, 'tutorial-feature.title', 'default title');
```

> [!IMPORTANT]
> The evaluation context is passed to targeting verbatim, so use the wire spelling `targeting_key` — not OpenFeature's `targetingKey`.

## Resolve on the server, evaluate in the browser

If your application renders on the server, resolve there and forward the resulting `FlagBundle` to the browser. It is plain JSON, and `FlagBundle.evaluate` is a pure function, so the browser can evaluate flags without another resolve or a client secret. Browser-only applications can resolve through the web provider instead.

Defer exposure with `apply: false` so a flag counts as seen when it is actually used, rather than when it was resolved.

```ts
// Server: serialize the returned bundle into your page data.
async function loadFlags(userId: string) {
  return client.resolve(['promo-banner'], { targeting_key: userId }, { apply: false });
}
```

The browser sends the resolve token along with the accessed flag to an application
endpoint. `bundle` below is the page data returned by `loadFlags`:

```ts
import { FlagBundle } from '@spotify-confidence/sdk';

const showBanner = FlagBundle.evaluate(bundle, 'promo-banner.enabled', false);
if (showBanner.shouldApply) {
  await fetch('/api/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolveToken: bundle.resolveToken, flag: 'promo-banner' }),
  });
}
```

On the server, register an endpoint using your framework's routing API. For a
framework using standard `Request` and `Response` objects, the handler can be:

```ts
async function applyExposure(request: Request): Promise<Response> {
  const body = await request.json();
  if (!body || typeof body.resolveToken !== 'string' || !body.resolveToken || body.flag !== 'promo-banner') {
    return new Response('Invalid exposure request', { status: 400 });
  }
  const result = await client.apply(body.resolveToken, body.flag, { signal: AbortSignal.timeout(1000) });
  return new Response(null, { status: result.ok ? 204 : 502 });
}
```

The client secret stays on the server. The remote resolver checks that the token
covers the requested flag. Forward only the flags intended for the browser. You
can also retain the token on the server and bind it to an action or server-side
session instead of including it in page data.

## Region

By default both flag resolution and event publishing go to the global region. Set `region` to pin them for data residency — it places both services, since events carry data of their own:

```ts
const client = new ConfidenceClient({
  clientSecret: 'my secret',
  region: 'eu', // or 'us'
});
```

## Pointing at your own resolver

There is no url option. To reach a resolver you run yourself, rewrite the URL in `fetch` — which is also how you reach a Cloudflare service binding:

```ts
const client = new ConfidenceClient({
  clientSecret: env.CONFIDENCE_CLIENT_SECRET,
  fetch: (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    return url.hostname === 'resolver.confidence.dev' ? env.RESOLVER.fetch(input, init) : globalThis.fetch(input, init);
  },
});
```

> [!NOTE] > `env.RESOLVER` is a binding supplied by your Worker application. Call its method with the binding as receiver: a detached `fetch` can fail with "Illegal invocation". This example routes flag operations to the binding and keeps event publishing on the events service. If you set `region`, match the corresponding regional resolver hostname.

## Resolving flags

`resolve` takes the flag names to resolve — or an empty array for every flag available to the client — and returns a `FlagBundle`.

```ts
const bundle = await client.resolve(['promo-banner'], { targeting_key: 'user-1', country: 'SE' });

bundle.flags['promo-banner']; // { reason, value, variant, shouldApply, assignmentOrigin }
bundle.resolveId; // identifies this resolve
bundle.resolveToken; // empty unless apply was deferred
```

`apply` defaults to `true`, so a plain `resolve` counts as an exposure.

### Evaluating

`FlagBundle.evaluate` takes a default value, which fixes the expected type. A resolved value that does not match the default's type yields the default with a `TYPE_MISMATCH` error, and dot notation reads into the flag's value:

```ts
FlagBundle.evaluate(bundle, 'promo-banner', { enabled: false, title: '' });
FlagBundle.evaluate(bundle, 'promo-banner.title', 'default title');
```

Each result carries the `reason` the flag resolved the way it did, the assigned `variant`, and `shouldApply`. Pass an optional `Logger` as the fourth argument to have evaluation failures reported.

## Recording exposure

When a resolve deferred exposure, `apply` records it against the bundle's token. Pass one flag name or several; several are sent in a single request.

```ts
const result = await client.apply(bundle.resolveToken, ['promo-banner']);
```

Flags whose `shouldApply` is false can be skipped — applying them has no observable effect.

## Publishing events

`publish` sends an event, or a batch of them in a single request:

```ts
await client.publish({
  name: 'order-completed',
  payload: { context: { targeting_key: 'user-1' }, item_count: 2 },
});
```

`payload.context` is what Confidence attributes an event by — it joins the event to the flag exposures for the same targeting context. Nothing enforces it, but an event published without it cannot be attributed.

Nothing is queued: the request goes out on call. Small publish and apply requests use `keepalive` to allow delivery during navigation, subject to browser quotas and network availability. If you want batching, build the queue on top and publish an array:

```ts
await client.publish([
  { name: 'page-viewed', payload, eventTime: whenItHappened },
  { name: 'order-completed', payload, eventTime: whenItHappened },
]);
```

Set `eventTime` per event when doing so. It defaults to the time the request is sent, which is right for a direct publish but would restamp a queued batch with the flush time.

## Errors

`resolve`, `apply`, and `publish` report request failures as values instead of rejecting.

A failed resolve returns an errored bundle rather than throwing, so the failure travels to the browser correctly labelled instead of looking like a missing flag. Evaluating against it yields your defaults with an `ERROR` reason:

```ts
const bundle = await client.resolve(['promo-banner'], context);
if (bundle.errorCode) {
  // 'TIMEOUT' or 'GENERAL' — evaluation still works, and returns defaults
}
```

`apply` and `publish` return a `WriteResult` instead of rejecting, because the natural call site is fire-and-forget and an unhandled rejection terminates the process on Node:

```ts
const result = await client.apply(token, 'promo-banner');
if (!result.ok) {
  // result.errorCode, result.errorMessage, and result.status for HTTP failures
}
```

The events endpoint can also reject an individual event within an otherwise successful HTTP 200. A `publish` result then carries `errors` naming which events of the batch were rejected, by index — everything else in it was recorded.

Failures are reported through the `logger` if one was passed.

Malformed publish responses are reported as failures. A transport failure or
timeout means delivery was not confirmed; it does not prove the write was not
recorded. Retrying an event after such a failure can create duplicates.

## Timeouts and cancellation

There is no `timeout` option — pass an `AbortSignal`, which covers both deadlines and cancellation:

```ts
await client.resolve(flags, context, { signal: AbortSignal.timeout(1000) });
await client.apply(token, flags, { signal: AbortSignal.timeout(1000) });
await client.publish(event, { signal: AbortSignal.timeout(1000) });
```

A signal that aborts on a deadline is reported as `TIMEOUT`; a deliberate `controller.abort()` is not. The thin client never retries. Inspect the result and your endpoint's error semantics before deciding whether to retry: HTTP status alone does not always distinguish permanent from transient failures. The web provider adds its own bounded exposure retry, documented in its [delivery and shutdown guide](../openfeature-web-provider/README.md#exposure-delivery-and-shutdown).

# The Confidence class

> [!NOTE]
> Being phased out — see the recommendations at the top of this page.

## Initializing the SDK

Run the `Confidence.create` function to obtain a root instance of `Confidence`.

The SDK initialization requires an API key (`clientSecret`) to work. This key obtained through the [Confidence console](https://app.confidence.spotify.com/).

```ts
import { Confidence } from '@spotify-confidence/sdk';

const confidence = Confidence.create({
  clientSecret: 'my secret',
  region: 'eu', // or 'us'
  environment: 'client', // or 'backend'
  timeout: 1000,
});
```

### Region

The region option is used to set the region for the network request to the Confidence backend. When the region is not set, the default (global) region will be used.
The current regions are: `eu` and `us`.

### Timeout

The timeout option is used to set the timeout for the feature flag resolve network request to the Confidence backend. When the timeout is reached, default values will be returned.

### Logging

During your integration and when debugging, you can get helpful logging information by defining a `logger` when creating the Confidence instance. The `Logger` is an interface for you to implement. It's very similar to the console object, but all the logging functions (`debug`, `info`, `warn` etc) are optional, so you just provide the ones you are interested in. Providing console as the logger will log everything to the console. If you don't want any logging you can provide `{}` which is also a valid `Logger` implementation. If no logger is provided it will default to logging `info` or higher in development, but no logging in production.

```ts
import { Confidence } from '@spotify-confidence/sdk';

const myLogger = {
  warn: message => {
    console.log('Confidence warning: ', message);
  },
  error: message => {
    console.log('Confidence error: ', message);
  },
};

const confidence = Confidence.create({
  clientSecret: 'mysecret',
  region: 'eu',
  environment: 'client',
  logger: myLogger,
  timeout: 1000,
});
```

## Setting the context

You can set the context manually by using `setContext({})`:

```ts
confidence.setContext({ 'pants-color': 'yellow' });
```

or obtain a "child instance" of Confidence with a modified context by using `withContext({})`

```ts
const childInstance = confidence.withContext({ 'pants-color': 'blue', 'pants-fit': 'slim' });
```

At this point, the context of `childInstance` is `'pants-color': 'blue', 'pants-fit': 'slim'` while the context of `confidence` remains `{'pants-color': 'yellow'}`.

> [!IMPORTANT]
> When using the SDK in a server environment, you should call `withContext` rather than `setContext`. This will give you a new instance scoped to the request and prevent context from leaking between requests.
>
> Call `confidence.close()` on shutdown to flush any pending telemetry before the process exits.

## Accessing flags

Flags can be accessed with two different API's.

The flag value API returns the Confidence assigned flag value or the passed in default value if no value was returned.
The evaluate API returns a `FlagEvaluation` type that also contain information about `variant`, `reason` and possible error details.

```ts
const flag = await confidence.getFlag('tutorial-feature', {});
const flagEvaluation = await confidence.evaluateFlag('tutorial-feature', {});
```

### Dot notation

Both the "flag value", and the "evaluate" API's support dot notation, meaning that if the Confidence flag has a property `enabled` or `title` on the flag, you can access them directly:

```ts
const enabled = await confidence.getFlag('tutorial-feature.enabled', false);
const messageEvaluation = await confidence.evaluateFlag('tutorial-feature.message', 'default message');
const message = messageEvaluation.value;
```

### Synchronous access

In a client application (where `environment` is set to `client`), the SDK fetches and caches all flags when the context is updated. This means the flags can be accessed synchronously after that.

### Caching

Flag evaluations are cached in memory on the Confidence instance with the evaluation context and flag name as a cache key.
This is done to reduce network calls when evaluating multiple flags using the same context.

```ts
const confidence = Confidence.create({ clientSecret: 'your-client-secret', timeout: 1000 });
const flag = await confidence.getFlag('flag', {});
// subsequent calls to getFlag will return the same value
```

Creating a child with `withContext({})` does not guarantee a fresh network
request; the legacy API can share cached resolutions. For explicit uncached
requests, use [`ConfidenceClient.resolve`](#resolving-flags).

## Event tracking

Use `confidence.track()` from any Confidence instance to track an event in Confidence. Any context data set on the instance will be appended to the tracking event.

```ts
confidence.track('event_name', { 'message-detail1': 'something interesting' });
```

### Auto track

Confidence supports automatically tracking certain things out of the box and supports API's for you to extend that functionality.

#### Visitor ID (web)

Confidence can provide all flag resolves and tracking events with a browser specific identifier. We call this `visitor_id`.  
The `visitor_id` is stored in a cookie named `cnfdVisitorId`. To add a generated `visitor_id` to the context, use the following:

```ts
import { visitorIdentity } from '@spotify-confidence/sdk';
confidence.track(visitorIdentity());
```

To share the visitor ID across subdomains, set the `domain` option:

```ts
confidence.track(visitorIdentity({ domain: '.example.com' }));
```

#### Page Views (web)

Confidence can automatically track `page views` on events such as `load`, `pushState`, `replaceState`, `popstate` and `hashchange`.
To automatically track `page views`, use the following:

```ts
import { Confidence, pageViews } from '@spotify-confidence/sdk';
confidence.track(pageViews());
```

#### Web vitals (web)

To automatically send tracking events containing [web vitals data](https://web.dev/articles/vitals), use:

```ts
import { Confidence, webVitals } from '@spotify-confidence/sdk';
confidence.track(webVitals());
```
