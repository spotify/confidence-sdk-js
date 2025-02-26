# JavaScript Confidence SDK Monorepo

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

JavaScript implementation of the [Confidence](https://confidence.spotify.com/) SDK and the Confidence OpenFeature provider, to be used in conjunction wth the [OpenFeature SDK](https://github.com/open-feature/js-sdk).

# Usage

We recommend to try out Confidence using the vanilla [sdk](packages/sdk/README.md). The setup guide below will help you get started.

This monorepo exports multiple packages, with their own docs:

- [sdk](packages/sdk/README.md)
- [react](packages/react/README.md)
- [openfeature-web-provider](packages/openfeature-web-provider/README.md)
- [openfeature-server-provider](packages/openfeature-server-provider/README.md)

## SDK setup

### Adding the dependencies

To add the packages to your dependencies run:

```sh
yarn add @spotify-confidence/sdk
```

### Initializing the SDK

Run the `Confidence.create` function to obtain a root instance of `Confidence`.

The SDK initialization requires an API key (`clientSecret`) to work. This key obtained through the [Confidence console](https://app.confidence.spotify.com/).

```ts
import { Confidence } from '@spotify-confidence/sdk';

const confidence = Confidence.create({
  clientSecret: 'mysecret',
  region: 'eu', // or 'us'
  environment: 'client', // or 'backend'
  timeout: 1000,
});
```

### Setting the context

You can set the context manually by using `setContext({})` or obtain a "child instance" of Confidence with a modified context by using `withContext({})`.

```ts
confidence.setContext({ 'pants-color': 'yellow' });
const childInstance = confidence.withContext({ 'pants-color': 'blue', 'pants-fit': 'slim' });
```

> [!IMPORTANT]
> When using the SDK in a server environment, you should call `withContext` rather than `setContext`. This will give you a new instance scoped to the request and prevent context from leaking between requests.

### Accessing flags

The flag value API returns the Confidence assigned flag value or the passed in default value if no value was returned.
The API supports dot notation, meaning that if the Confidence flag has a property `enabled` on the flag, you can access it directly.

```ts
const flag = await confidence.getFlag('tutorial-feature', {});
if (flag.enabled) {
  // ship it!
}
// or
const enabled = await confidence.getFlag('tutorial-feature.enabled', false);
if (enabled) {
  // ship it!
}
```

> [!TIP]
> If you are troubleshooting flag values, the flag evaluation API can be really useful since it returns a `FlagEvaluation` type that contain information about `variant`, `reason` and possible error details.

```ts
const flagEvaluation = await confidence.evaluateFlag('tutorial-feature', {});
```

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

## Example apps

This repo contains a few example apps (under examples/) to display and test the functionality. These apps depend on the bundled output of the main packages, so you will need to run `yarn bundle` before starting any of the apps.

## Code of Conduct

This project adheres to the [Open Source Code of
Conduct](https://github.com/spotify/code-of-conduct/blob/master/code-of-conduct.md).
By participating, you are expected to honor this code.

## License

Copyright 2023 Spotify AB.

Licensed under the Apache License, Version 2.0: http://www.apache.org/licenses/LICENSE-2.0
