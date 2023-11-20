# JavaScript Confidence Provider

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

JavaScript implementation of the [Confidence](https://confidence.spotify.com/) feature provider, to be used in conjunction wth the [OpenFeature SDK](https://github.com/open-feature/js-sdk).

# Usage

This monorepo exports multiple packages, with their own docs:

- [openfeature-web-provider](packages/openfeature-web-provider/README.md)
- [openfeature-server-provider](packages/openfeature-server-provider/README.md)
- [integration-react](packages/integration-react/README.md)

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

## Code of Conduct

This project adheres to the [Open Source Code of
Conduct](https://github.com/spotify/code-of-conduct/blob/master/code-of-conduct.md).
By participating, you are expected to honor this code.

## License

Copyright 2023 Spotify AB.

Licensed under the Apache License, Version 2.0: http://www.apache.org/licenses/LICENSE-2.0
