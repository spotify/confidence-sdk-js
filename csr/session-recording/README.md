# @spotify-confidence/session-recording

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

Browser SDK for recording user sessions with [Confidence](https://confidence.spotify.com). Captures DOM events in real time and streams them to the Confidence backend for analysis.

## Installation

```bash
npm install @spotify-confidence/session-recording
```

## Quick start

```typescript
import { initSessionRecorder } from '@spotify-confidence/session-recording';

const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
});
```

That's it. In `automatic` mode (the default), recording begins as soon as a session is established with the backend. The SDK handles sampling, transport, and reconnection automatically.

## Privacy: masking and blocking

The SDK provides two mechanisms to prevent sensitive content from being captured:

**Masking** replaces text content with `•` characters while preserving the layout. The element is still visible in the replay, but the actual text is never sent to the backend.

```typescript
const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
  maskSelectors: ['.pii', '[data-sensitive]'],
  maskInputs: true, // mask all <input>, <textarea>, and contenteditable values (default: true)
});
```

**Blocking** replaces entire subtrees with an empty placeholder. The blocked element's dimensions are preserved, but nothing inside it — text, images, child nodes — is serialized or sent.

```typescript
const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
  blockSelectors: ['video', '.third-party-widget', '[data-block]'],
});
```

`maskInputs` defaults to `true` — all input values are masked unless you explicitly opt out.

## Context

Context lets you attach custom dimensions to the recording session. These are sent alongside the auto-collected browser metadata (user agent, OS, viewport, language, timezone) in the session init request. Context serves two purposes: it helps you find and filter recordings later, and the backend uses it to target recordings to specific cohorts of your user population (e.g. only record premium users, or users on a specific build version).

```typescript
const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
  context: {
    buildVersion: '2.3.1',
    environment: 'production',
    plan: 'premium',
    featureFlags: 'new-checkout-enabled',
  },
});
```

## Configuration

```typescript
const recorder = initSessionRecorder({
  // Required
  clientSecret: '<your-client-secret>',

  // Context
  context: { buildVersion: '2.3.1' },

  // Privacy
  maskSelectors: ['.pii'],
  blockSelectors: ['video'],
  maskInputs: true, // default: true

  // Capture options
  captureConsoleLogs: true, // capture browser console output (default: false)
  captureNetworkRequests: false, // capture fetch/XHR metadata (default: false)
  captureRouteChanges: true, // capture client-side route changes (default: true)

  // Recording mode
  mode: 'automatic', // 'automatic' (default) or 'manual'
});
```

## Route parameterization

Routes containing dynamic segments (such as IDs in the URL) are automatically normalized into patterns — for example, `/users/123/profile` becomes `/users/:id/profile`. This ensures that per-page metrics are grouped by route rather than by individual page visit, keeping dashboards meaningful and query performance fast.

If your app uses URL patterns that aren't automatically detected, you can provide a custom `parameterizeRoute` function to control how routes are grouped:

```typescript
import { defaultParameterizeRoute } from '@spotify-confidence/csr-recorder';

const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
  parameterizeRoute: route => {
    return defaultParameterizeRoute(route).replace(/\/teams\/[^/]+/, '/teams/:slug');
  },
});
```

See the [`@spotify-confidence/csr-recorder` README](../csr-recorder/README.md#route-parameterization) for the full list of default patterns.

## Manual mode

Use `manual` mode to control when recording starts — useful for gating on user consent or feature flags.

```typescript
const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
  mode: 'manual',
});

// Later, when ready:
recorder.start();
```

## Custom tags and measurements

Attach metadata to a recording for filtering and analysis.

```typescript
recorder.tag('plan', 'premium');
recorder.measure('checkout_items', 3);
```

## API

### `initSessionRecorder(options): SessionRecorder`

Creates a session recorder. Always returns a `SessionRecorder` — safe to call, never throws.

### `SessionRecorder`

| Method                 | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `start()`              | Start recording. No-op in automatic mode.                      |
| `stop()`               | Stop recording permanently. Idempotent.                        |
| `tag(key, value?)`     | Attach a string tag. Tags with the same key accumulate values. |
| `measure(key, value?)` | Record a numeric measurement. Same key = summed.               |
| `isRecording`          | Whether the recorder is actively capturing events.             |

## License

Apache 2.0 — see [LICENSE](../../LICENSE).
