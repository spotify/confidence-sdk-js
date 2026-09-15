# Confidence SDK

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

> [!NOTE]
> The stateful `Confidence` class has been removed. Use `ConfidenceClient` directly or an OpenFeature provider:
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
yarn add '@spotify-confidence/sdk@^0.5.0'
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
