# OpenFeature Web SDK JavaScript Confidence Provider

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

JavaScript implementation of the Confidence OpenFeature web provider, to be used in conjunction with the OpenFeature Web SDK.
This implements the static paradigm of OpenFeature.

# Usage

## Adding the dependencies

To add the packages to your dependencies run:

```sh
yarn add @openfeature/web-sdk @spotify-confidence/openfeature-web-provider
```

## Enabling the provider, setting the evaluation context and resolving flags

`setProvider` makes the Provider launch a network request to initialize the flags. In cases of success the
`ProviderEvents.Ready` event will be emitted. In cases of failure of the network request, the `ProviderEvent.Error`
event will be emitted. The ProviderEvents events will be emitted only when we are done with the network request, either
a successful or a failed network response. If the network response failed, default values will be returned on flag
evaluation, if the network request is successful we update the flags and then emit `ProviderEvents.Ready`.

```ts
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { OpenFeature } from '@openfeature/web-sdk';

const provider = createConfidenceWebProvider({
  clientSecret: 'mysecret',
  fetchImplementation: window.fetch.bind(window),
  timeout: 1000,
});

OpenFeature.setContext({
  targetingKey: 'myTargetingKey',
});

try {
  await OpenFeature.setProviderAndWait(provider);
} (error) {
  console.error('Failed to initialize Confidence provider:', error);
}

const client = OpenFeature.getClient();
const result = client.getBooleanValue('flagName.my-boolean', false);
```

Notes:

- In the above example we first set the context and then set the provider and await for the provider to become ready before getting the flag value. Other ways of arranging these calls might make more sense depending on what app framework you are using. See the example apps for more inspiration.

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

The timeout option is used to set the timeout for the network request to the Confidence backend. When the timeout is reached, default values will be returned.

## Logging

Resolve and apply failures are reported to the console in development, and go
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

Events are sent one request per event, immediately, with no batching. In a browser
the request uses `keepalive`, so an event fired just before a navigation still
arrives. The tracking API returns `void`, so failures cannot be reported back to
the caller; they are written to the [logger](#logging) instead.
