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
import { OpenFeature, OpenFeatureAPI } from '@openfeature/web-sdk';

const provider = createConfidenceWebProvider({
  clientSecret: 'mysecret',
  region: 'eu',
  fetchImplementation: window.fetch.bind(window),
});

await OpenFeature.setContext({
  targetingKey: 'myTargetingKey',
});
OpenFeature.setProvider(provider);

const client = OpenFeature.getClient();
const result = client.getBooleanValue('flag.my-boolean', false);
```

Notes:

- It's advised not to perform `setContext` while `setProvider` is running, you can await setting the context first, or listen to the `ProviderEvent.Ready` via a handler on `OpenFeaure`.
- It's advised not to perform resolves while `setProvider` and `setContext` are running: resolves might return the default value with reason `STALE` during such operations.

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
