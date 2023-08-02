# OpenFeature JS SDK JavaScript Confidence Provider

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

JavaScript implementation of the Confidence OpenFeature web provider, to be used in conjunction wth the OpenFeature JS SDK.
This implements the dynamic paradigm of OpenFeature.

# Usage

## Adding the dependencies

To add the packages to your dependencies run:

```sh
yarn add @openfeature/js-sdk @spotify-confidence/openfeature-server-provider
```

## Enabling the provider, setting the evaluation context and resolving flags

```ts
import { createConfidenceServerProvider } from '@spotify-confidence/openfeature-server-provider';
import { OpenFeature, OpenFeatureAPI } from '@openfeature/js-sdk';
import { fetch } from 'node-fetch';

const provider = createConfidenceServerProvider({
  clientSecret: 'mysecret',
  region: 'eu',
  fetchImplementation: fetch,
});

OpenFeature.setProvider(provider);
OpenFeature.setContext({ targetingKey: 'myTargetingKey' });

const client = OpenFeature.getClient();
const result = await client.getBooleanValue('flag.my-boolean', false, {
  someOtherContext: true,
});
```
