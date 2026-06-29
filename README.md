# JavaScript Confidence SDK Monorepo

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

JavaScript SDKs for [Confidence](https://confidence.spotify.com/).

## Overview

### Feature Flags

Feature flag resolution via [OpenFeature](https://github.com/open-feature/js-sdk) or the standalone Confidence SDK.

> **💡 For server-side use cases**, consider the [Confidence Local Resolver Provider for JavaScript](https://github.com/spotify/confidence-resolver/tree/main/openfeature-provider/js), which evaluates flags locally via WebAssembly for increased resilience and lower latency.

| Package                                                                 | Description                                               |
| ----------------------------------------------------------------------- | --------------------------------------------------------- |
| [`openfeature-server-provider`](./packages/openfeature-server-provider) | OpenFeature provider for server-side environments         |
| [`openfeature-web-provider`](./packages/openfeature-web-provider)       | OpenFeature provider for client-side web applications     |
| [`sdk`](./packages/sdk)                                                 | Core SDK for flag resolution, context, and tracking       |
| [`react`](./packages/react)                                             | React hooks and providers for client-side applications    |

### Session Recording

Browser SDK for capturing user sessions and streaming them to Confidence for replay and analysis.

| Package                                                                 | Description                                              |
| ----------------------------------------------------------------------- | -------------------------------------------------------- |
| [`session-recording`](./csr/session-recording)                          | Session recording SDK — start here                       |
| [`csr-recorder`](./csr/csr-recorder)                                    | Low-level recording engine (internal)                    |
| [`csr-common`](./csr/csr-common)                                        | Shared types, events, and transport utilities (internal) |

---

# Usage with OpenFeature

OpenFeature provides a standardized API for feature flagging that works across different providers and languages.

## Server Applications (Node.js)

> [!TIP]
> For better resilience and lower latency, see the [Confidence Local Resolver Provider](https://github.com/spotify/confidence-resolver/tree/main/openfeature-provider/js) which resolves flags locally without per-evaluation network calls.

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
  visitor_id: `<unique id per visitor>`,
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
  visitor_id: `<unique id per visitor>`,
});

try {
  await OpenFeature.setProviderAndWait(provider);
} catch (error) {
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

> [!NOTE]
> The standalone SDK is being phased out. For new integrations, we recommend using the OpenFeature APIs described above.

The vanilla sdk can be used in cases where you want direct access to the Confidence SDK, including event tracking and custom context management.

> **Learn more**: [SDK Documentation](./packages/sdk/README.md)

## React Integration

> [!NOTE]
> The standalone React SDK is being phased out. For new integrations, see the [OpenFeature React SDK](https://openfeature.dev/docs/reference/sdks/client/web/react/) section above, or consider server-side flag resolution for SSR applications.

For React applications, use the dedicated React package that provides hooks and providers for seamless integration. This package is built on top of the direct SDK usage.

> **Learn more**: [React Integration Documentation](./packages/react/README.md)

---

# Content Security Policy (CSP)

When using the Confidence SDK in web applications with Content Security Policy enabled, you'll need to configure the following CSP directives to ensure proper functionality.

## Required CSP Directives

### `connect-src`

The SDK makes HTTP requests to Confidence API endpoints. Add these domains to your `connect-src` directive:

```
connect-src 'self' https://*.confidence.dev
```

This covers:

- `https://resolver.confidence.dev` (global flag resolution)
- `https://resolver.eu.confidence.dev` (EU region flag resolution)
- `https://resolver.us.confidence.dev` (US region flag resolution)
- `https://events.confidence.dev` (global event tracking)
- `https://events.eu.confidence.dev` (EU region event tracking)
- `https://events.us.confidence.dev` (US region event tracking)

### Additional Considerations

- **Custom resolve URLs**: If you use a custom `resolveBaseUrl` in your configuration, make sure to include that domain in your `connect-src` directive
- **Web Vitals**: The SDK includes optional web vitals tracking that uses the `web-vitals` library, but this doesn't require additional CSP permissions as it only uses browser APIs
- **No inline scripts**: The SDK doesn't inject any inline scripts or styles, so you don't need `unsafe-inline` permissions

# Next.js Pages Router Development Patch

When using the Confidence React SDK with Next.js **Pages Router** _in development mode_, you may need to apply a patch to the Next.js development server to improve error handling during server-side rendering. Run `yarn patch-next-dev apply` from the `@spotify-confidence/react` package to apply this patch, which helps prevent development server visual crash overlay when using SSR with feature flags.

Please note that this is purely a development issue and not something that affects production builds.

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
