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

The region option is used to set the region for the network request to the Confidence backend. When the region is not set, the default (global) region will be used.
The current regions are: `eu` and `us`, the region can be set as follows:

```ts
const provider = createConfidenceServerProvider({
  region: 'eu', // or 'us'
  // ... other options
});
```

## Timeout

The timeout option is used to set the timeout for the network request to the Confidence backend. When the timeout is reached, default values will be returned.

## Configuring Apply

See [apply concept](../../concepts/apply.md).

Backend apply is the only supported method in the `ConfidenceServerProvider`.
