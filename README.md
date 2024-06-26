# JavaScript Confidence SDK Monorepo

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

JavaScript implementation of the [Confidence](https://confidence.spotify.com/) SDK and the Confidence OpenFeature provider, to be used in conjunction wth the [OpenFeature SDK](https://github.com/open-feature/js-sdk).

# Usage

This monorepo exports multiple packages, with their own docs:

- [openfeature-web-provider](packages/openfeature-web-provider/README.md)
- [openfeature-server-provider](packages/openfeature-server-provider/README.md)
- [sdk](packages/sdk/README.md)

# Development

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
yarn bundle
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
