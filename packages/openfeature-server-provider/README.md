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
import { OpenFeature } from '@openfeature/js-sdk';

const provider = createConfidenceServerProvider({
  clientSecret: 'your-client-secret',
  region: 'eu',
  fetchImplementation: fetch,
});

OpenFeature.setProvider(provider);

const client = OpenFeature.getClient();

client
  .getBooleanValue('flagname.bool', false, {
    targetingKey: `your targeting key`,
  })
  .then(result => {
    console.log('result:', result);
  });
```
