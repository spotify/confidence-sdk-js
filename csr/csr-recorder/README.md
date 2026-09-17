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

Raw capture remains the default when either capture option is `true`. Use the built-in sanitizer to remove query strings
and fragments from network URLs and URLs inside console payloads and traces:

Raw URLs and console output can contain sensitive data from first-party or third-party code. Select a sanitization policy
before you enable these capture channels in production.

```typescript
const stop = record(event => {}, {
  captureNetworkRequests: { sanitize: true },
  captureConsoleLogs: { levels: ['warn', 'error'], sanitize: true },
});
```

Set `sanitize` to `(value: string) => string` for a custom policy. A network sanitizer receives each request URL. A
console sanitizer receives each payload and trace string. The built-in sanitizer changes only URL-like text, so use a
function to remove secrets stored elsewhere in console data. If the sanitizer throws or returns a non-string value, the
capture event is dropped. Pass `debugLogger` to receive a `SECURITY` warning without the unsanitized value.

## Route parameterization

Routes containing dynamic segments (such as IDs in the URL) are automatically normalized into patterns — for example, `/users/123/profile` becomes `/users/:id/profile`. This ensures that per-page metrics are grouped by route rather than by individual page visit, keeping dashboards meaningful and query performance fast.

Default replacements:

| Pattern                | Example                                | Replacement |
| ---------------------- | -------------------------------------- | ----------- |
| UUID                   | `550e8400-e29b-41d4-a716-446655440000` | `:uuid`     |
| Numeric ID             | `123`                                  | `:id`       |
| AIP-122 ID             | `cmvkznnjmbkc9rw2oxws`                 | `:id`       |
| Hex string (20+ chars) | `507f1f77bcf86cd799439011`             | `:id`       |

If your app uses URL patterns that aren't automatically detected, you can provide a custom `parameterizeRoute` function to control how routes are grouped:

```typescript
import { record, defaultParameterizeRoute } from '@spotify-confidence/csr-recorder';

const stop = record(event => {}, {
  parameterizeRoute: route => {
    // Apply defaults first, then handle your own patterns
    return defaultParameterizeRoute(route).replace(/\/teams\/[^/]+/, '/teams/:slug');
  },
});
```

The same parameterization is also applied to the `href` in rrweb Meta events. Query strings and fragments are removed from Meta event URLs and the session's document referrer before recording.

## rrweb version

This package pins `rrweb@^2.0.0-alpha.20`. The rrweb 2.x line is in alpha but is the version we've validated against. The recording engine is bundled — consumers do not need rrweb as a peer dependency.

## License

Apache 2.0 — see [LICENSE](../../LICENSE).
