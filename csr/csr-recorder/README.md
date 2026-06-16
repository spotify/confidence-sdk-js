# @spotify-confidence/csr-recorder

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

Low-level browser recording engine that captures DOM events using [rrweb](https://github.com/rrweb-io/rrweb). This package is used internally by `@spotify-confidence/session-recording` — most consumers should use that SDK directly.

## Usage

```typescript
import { record } from '@spotify-confidence/csr-recorder';

const stop = record(
  event => {
    // handle each recording event
  },
  {
    maskSelectors: ['.sensitive'],
    blockSelectors: ['video'],
    maskInputs: true,
    captureConsoleLogs: true,
    captureNetworkRequests: false,
    captureRouteChanges: true,
  },
);

// Later:
stop();
```

## Route parameterization

When `captureRouteChanges` is enabled (the default), recorded pathnames are automatically parameterized before being emitted. This replaces dynamic segments with named placeholders so that analytics can group routes by pattern rather than individual URLs.

Default replacements:

| Pattern                | Example                                | Replacement |
| ---------------------- | -------------------------------------- | ----------- |
| UUID                   | `550e8400-e29b-41d4-a716-446655440000` | `:uuid`     |
| Numeric ID             | `123`                                  | `:id`       |
| AIP-122 ID             | `cmvkznnjmbkc9rw2oxws`                 | `:id`       |
| Hex string (20+ chars) | `507f1f77bcf86cd799439011`             | `:id`       |

Provide a custom function to handle application-specific patterns:

```typescript
import { record, defaultParameterizeRoute } from '@spotify-confidence/csr-recorder';

const stop = record(event => {}, {
  parameterizeRoute: route => {
    // Apply defaults first, then handle your own patterns
    return defaultParameterizeRoute(route).replace(/\/teams\/[^/]+/, '/teams/:slug');
  },
});
```

The same parameterization is also applied to the `href` in rrweb Meta events.

## rrweb version

This package pins `rrweb@^2.0.0-alpha.20`. The rrweb 2.x line is in alpha but is the version we've validated against. The recording engine is bundled — consumers do not need rrweb as a peer dependency.

## License

Apache 2.0 — see [LICENSE](../../LICENSE).
