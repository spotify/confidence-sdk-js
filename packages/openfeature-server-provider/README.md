# OpenFeature Server SDK JavaScript Confidence Provider

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

JavaScript implementation of the Confidence OpenFeature server provider, to be used in conjunction with the OpenFeature Server SDK.
This implements the dynamic paradigm of OpenFeature.

# Usage

## Adding the dependencies

To add the packages to your dependencies run:

```sh
yarn add @openfeature/server-sdk @openfeature/core @spotify-confidence/sdk @spotify-confidence/openfeature-server-provider
```

## Enabling the provider, setting the evaluation context and resolving flags

```ts
import { createConfidenceServerProvider } from '@spotify-confidence/openfeature-server-provider';
import { OpenFeature } from '@openfeature/server-sdk';

const provider = createConfidenceServerProvider({
  clientSecret: 'your-client-secret',
  fetchImplementation: fetch,
  timeout: 1000,
});

OpenFeature.setProvider(provider);

const client = OpenFeature.getClient();

client
  .getBooleanValue('flagName.bool', false, {
    targetingKey: `your targeting key`,
  })
  .then(result => {
    console.log('result:', result);
  });
```

## Region

The region option is used to set the region for the network requests to the Confidence backend — both flag resolution and event publishing. When the region is not set, the default (global) region will be used.
The current regions are: `eu` and `us`, the region can be set as follows:

```ts
const provider = createConfidenceServerProvider({
  region: 'eu', // or 'us'
  // ... other options
});
```

## Timeout

The timeout option is used to set the timeout for the network request to the Confidence backend. When the timeout is reached, default values will be returned.

## Logging

Resolve failures are reported to the console in development, and go unreported
otherwise. Pass a `logger` — anything with a subset of `console`'s methods — to
report them wherever you collect diagnostics:

```ts
const provider = createConfidenceServerProvider({
  logger: { warn: message => myTelemetry.warn(message) },
  // ... other options
});
```

## Configuring Apply

See [apply concept](../../concepts/apply.md).

Backend apply is the only supported method in the `ConfidenceServerProvider`.

## Event tracking

Tracking details are added to the Confidence event payload. `context` is reserved for the evaluation context and is ignored when used as a tracking detail key.

The provider implements the OpenFeature tracking API, so `client.track()` sends an
event to Confidence:

```ts
const client = OpenFeature.getClient();
client.track('order-completed', { targetingKey: 'user-1' }, { value: 42, currency: 'SEK' });
```

As with flag evaluation in the dynamic paradigm, the evaluation context is passed
per call.

Events are sent one request per event, immediately, with no batching. The tracking
API returns `void`, so failures cannot be reported back to the caller; they are
written to the [logger](#logging) instead.
