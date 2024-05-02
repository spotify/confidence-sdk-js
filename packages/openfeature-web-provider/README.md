# OpenFeature Web SDK JavaScript Confidence Provider

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

JavaScript implementation of the Confidence OpenFeature web provider, to be used in conjunction wth the OpenFeature Web SDK.
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

await OpenFeature.setProviderAndWait(provider);

const client = OpenFeature.getClient();
const result = client.getBooleanValue('flagName.my-boolean', false);
```

Notes:

- In the above example we first set the context and then set the provider and await for the provider to become ready before getting flags values. Other ways of arranging these calls might make more sense depending on what app framework you are using. See the example apps for more inspiration.

## Region

The region option is used to set the region for the network request to the Confidence backend. When the region is not set, the default (global) region will be used.
The current regions are: `eu` and `us`, the region can be set as follows:

```ts
const provider = createConfidenceWebProvider({
  region: 'eu', // or 'us'
  // ... other options
});
```

## Timeout

The timeout option is used to set the timeout for the network request to the Confidence backend. When the timeout is reached, default values will be returned.

## Configuring Apply

See [apply concept](../../concepts/apply.md).

By default, `'access'` apply is used, using a timeout of 250ms.

To use Backend Apply, set the apply option to `'backend'`:

```ts
const provider = createConfidenceWebProvider({
    ...,
    apply: 'backend'
});

```
