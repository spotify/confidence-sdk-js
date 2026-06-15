# csr-recorder

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

## rrweb version

This package pins `rrweb@^2.0.0-alpha.20`. The rrweb 2.x line is in alpha but is the version we've validated against. The recording engine is bundled — consumers do not need rrweb as a peer dependency.

## License

Apache 2.0 — see [LICENSE](../../LICENSE).
