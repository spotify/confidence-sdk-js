# OpenFeature Web SDK JavaScript Confidence Provider

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

JavaScript implementation of the Confidence OpenFeature web provider, to be used in conjunction with the OpenFeature Web SDK.
This implements the static paradigm of OpenFeature.

# Usage

## Adding the dependencies

To add the packages to your dependencies run:

```sh
yarn add '@openfeature/web-sdk@^1.3.2' @openfeature/core '@spotify-confidence/sdk@^0.4.0' @spotify-confidence/openfeature-web-provider
```

## Enabling the provider, setting the evaluation context and resolving flags

Requires `@openfeature/web-sdk >=1.3.2 <2` and `@spotify-confidence/sdk >=0.4.0 <0.5.0`.
For existing integrations, see the [migration guide](../../concepts/migrate-to-thin-client.md).

`setProviderAndWait` resolves all available flags for the current context before
returning. It rejects if initialization fails; subsequent evaluations return
defaults with an error reason. Successful initialization puts the provider in
READY. Configure a logger to retain resolve diagnostics: some OpenFeature SDK
versions discard the provider's error message when producing evaluation details.

```ts
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { OpenFeature } from '@openfeature/web-sdk';

const provider = createConfidenceWebProvider({
  clientSecret: 'mysecret',
  fetchImplementation: window.fetch.bind(window),
  timeout: 1000,
});

await OpenFeature.setContext({
  targetingKey: 'myTargetingKey',
});

try {
  await OpenFeature.setProviderAndWait(provider);
} catch (error) {
  console.error('Failed to initialize Confidence provider:', error);
}

const client = OpenFeature.getClient();
const result = client.getBooleanValue('flagName.my-boolean', false);
```

Notes:

- Set context before initialization, then await the provider before evaluating flags.

## Changing context

Context changes resolve a new bundle asynchronously. Await `setContext` before
reading values or recording events that should correspond to the new assignments:

```ts
await OpenFeature.setContext({ targetingKey: 'another-user' });
const enabled = client.getBooleanValue('flagName.my-boolean', false);
```

During reconciliation, evaluations may still read the previous bundle. A failed
resolve replaces it with an error bundle, so evaluations return defaults. A
superseded resolve cannot overwrite the latest bundle. Each bundle keeps its own
exposure token, including when outgoing exposure is flushed during replacement.

## Region

The region option is used to set the region for the network requests to the Confidence backend — both flag resolution and event publishing. When the region is not set, the default (global) region will be used.
The current regions are: `eu` and `us`, the region can be set as follows:

```ts
const provider = createConfidenceWebProvider({
  region: 'eu', // or 'us'
  // ... other options
});
```

## Timeout

The timeout option bounds each resolve, exposure, and event request. A timed-out resolve makes flag evaluations return defaults. Each exposure retry gets its own deadline.

## Logging

Resolve, exposure, and event failures are reported to the console in development, and go
unreported otherwise. Pass a `logger` — anything with a subset of `console`'s
methods — to report them wherever you collect diagnostics:

```ts
const provider = createConfidenceWebProvider({
  logger: { warn: message => myTelemetry.warn(message) },
  // ... other options
});
```

## Configuring Apply

See [apply concept](../../concepts/apply.md).

Access apply is used, as the static paradigm calls for: a flag counts as seen when
it is evaluated rather than when it was resolved. Flags evaluated close together
are applied in one request, over a 10ms window by default. Set `applyDebounce` to
widen the window, or to 0 to apply each flag as it is evaluated:

```ts
const provider = createConfidenceWebProvider({
  applyDebounce: 0,
  // ... other options
});
```

## Event tracking

Tracking details are added to the Confidence event payload. `context` is reserved for the evaluation context and is ignored when used as a tracking detail key.

The provider implements the OpenFeature tracking API, so `client.track()` sends an
event to Confidence:

```ts
const client = OpenFeature.getClient();
client.track('order-completed', { value: 42, currency: 'SEK' });
```

The OpenFeature client passes the current evaluation context along, so events are
attributed to the same context flags are resolved against — there is no separate
context to keep in sync.

Events are sent immediately, one request per event, without automatic retries
because an ambiguous failure could otherwise produce duplicates. Small event and
exposure requests use `keepalive`; delivery remains subject to browser quotas and
network availability. The tracking API returns `void`, so failures are reported
through the [logger](#logging).

## Exposure delivery and shutdown

Pending exposure is flushed when the page becomes hidden or receives `pagehide`.
An exposure request is retried once after 250ms on transport failures, timeouts,
HTTP 429, or HTTP 5xx. Retries use the original resolve token. After a failed
delivery, a later evaluation can attempt exposure again. Successful exposure is
deduplicated per resolve.

Provider shutdown flushes exposure and waits for pending exposure and event
requests, including the bounded retry. Await `OpenFeature.clearProviders()` when
explicitly shutting down. Browser lifecycle events cannot await shutdown and
delivery during navigation is best effort.
