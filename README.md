# JavaScript Confidence SDK Monorepo

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

JavaScript implementation of the [Confidence](https://confidence.spotify.com/) SDK and the Confidence OpenFeature provider, to be used in conjunction wth the [OpenFeature SDK](https://github.com/open-feature/js-sdk).

## Overview

This monorepo contains four packages:

| Package                                                                 | Description                                                    |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`openfeature-server-provider`](./packages/openfeature-server-provider) | OpenFeature provider for server-side environments              |
| [`openfeature-web-provider`](./packages/openfeature-web-provider)       | OpenFeature provider for client-side web applications          |
| [`sdk`](./packages/sdk)                                                 | Core Confidence SDK for flag resolution, context, and tracking |
| [`react`](./packages/react)                                             | React hooks and providers for client-side applications         |

Read more about the packages in their respective docs.

---

# Usage with OpenFeature

OpenFeature provides a standardized API for feature flagging that works across different providers and languages.

## Server Applications (Node.js)

Set up Confidence as an OpenFeature provider in your Node.js application with the following steps:

### 1. Install Dependencies

```sh
yarn add @openfeature/server-sdk @openfeature/core @spotify-confidence/openfeature-server-provider
```

### 2. Initialize and Set the Provider

```ts
import { OpenFeature } from '@openfeature/server-sdk';
import { createConfidenceServerProvider } from '@spotify-confidence/openfeature-server-provider';

const provider = createConfidenceServerProvider({
  clientSecret: 'your-client-secret', // Get from Confidence console
  fetchImplementation: fetch,
  timeout: 1000,
});

OpenFeature.setProvider(provider);
const client = OpenFeature.getClient();
```

### 3. Fetch a Flag

```ts
const isEnabled = await client.getBooleanValue('feature.enabled', false, {
  targetingKey: `your-targeting-key`,
});
```

> **Learn more**: [Server Provider Documentation](./packages/openfeature-server-provider/README.md)

## Web Applications (Client-Side)

The following shows how to set up the client-side provider:

```sh
yarn add @openfeature/web-sdk @openfeature/core @spotify-confidence/openfeature-web-provider
```

```ts
import { OpenFeature } from '@openfeature/web-sdk';
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';

const provider = createConfidenceWebProvider({
  clientSecret: 'your-client-secret',
  fetchImplementation: window.fetch.bind(window),
  timeout: 1000,
});

OpenFeature.setContext({
  targetingKey: 'your-targeting-key',
});

try {
  await OpenFeature.setProviderAndWait(provider);
} (error) {
  console.error('Failed to initialize Confidence provider:', error);
}


const client = OpenFeature.getClient();
const isEnabled = client.getBooleanValue('feature.enabled', false);
```

> **Learn more**: [Web Provider Documentation](./packages/openfeature-web-provider/README.md)

### OpenFeature React SDK

OpenFeature also provides a [React SDK](https://openfeature.dev/docs/reference/technologies/client/web/react) for integrating feature flags directly into React applications.

## Example Application

You can check out the example application, which is built with Next.js and uses the Confidence Server Provider together with OpenFeature, to see how the SDK can be applied within an application. This demo app provides a concrete example of integrating feature flags and context management.

> **See the example app:** [confidence-sdk-demos](https://github.com/spotify/confidence-sdk-demos)

---

# Direct SDK Usage

The vanilla sdk can be used in cases where you want direct access to the Confidence SDK, including event tracking and custom context management.

> **Learn more**: [SDK Documentation](./packages/sdk/README.md)

## React Integration

For React applications, use the dedicated React package that provides hooks and providers for seamless integration. This package is built on top of the direct SDK usage.

> **Learn more**: [React Integration Documentation](./packages/react/README.md)

---

# Contributions and Development

We'd love to get patches from you! See [Contributing](CONTRIBUTING.md) for details.

## Setup

You can install all dependencies by running

```sh
yarn
```

## Formatting

Code is formatted using prettier, you can format all files by running

```sh
yarn format
```

## Linting

To run the linter, run:

```sh
yarn lint
```

## Testing

Tests are based on jest and can be run with

```sh
yarn test
```

## Bundling and API reports

Before release the sources (and types) are bundled. This process also includes generating an API report to keep track of changes to the public API.
If you intend to change the public API you need to run the bundle command locally and commit the changed API report files, otherwise the commit will fail in CI. To update the API report run:

```sh
yarn bundle --local
```

## Code of Conduct

This project adheres to the [Open Source Code of
Conduct](https://github.com/spotify/code-of-conduct/blob/master/code-of-conduct.md).
By participating, you are expected to honor this code.

## License

Copyright 2023 Spotify AB.

Licensed under the Apache License, Version 2.0: http://www.apache.org/licenses/LICENSE-2.0
