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

Privacy settings live under `masking` and `blocking`:

```typescript
const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
  masking: {
    level: 'inputs', // 'none' | 'inputs' (default) | 'text'
    selectors: ['.pii', '[data-sensitive]'],
    attributes: ['data-user-email'],
  },
  blocking: {
    selectors: ['video', '.third-party-widget'],
  },
});
```

### Masking levels

Each level includes the one below it:

| `masking.level`    | Typed and pre-filled input values | Page text and text-bearing attributes            |
| ------------------ | --------------------------------- | ------------------------------------------------ |
| `none`             | Recorded                          | Recorded, except where `masking.selectors` match |
| `inputs` (default) | Masked                            | Recorded, except where `masking.selectors` match |
| `text`             | Masked                            | Masked, except inside `data-csr-unmask`          |

**Masking** replaces text with `*` of the same length, so layout is preserved but the text never leaves the page. `<input type="password">` is always masked. An unknown level masks everything and logs a `SECURITY` warning through `debugLogger`.

**Blocking** replaces whole subtrees matched by `blocking.selectors` with a same-sized placeholder. Nothing inside, including text, images and child nodes, is serialized. Defaults to `['[data-csr-block]', 'video']`; passing your own list replaces the defaults.

### Mask all text by default

If listing everything sensitive is impractical, use `level: 'text'`. All text is masked, and you opt components back in by adding `data-csr-unmask`:

```html
<nav data-csr-unmask>Home · Orders · Help</nav>
<p>Jane Doe</p>
<!-- recorded as ******** -->
```

Because the attribute lives on the component, it moves with the component when markup changes; there is no selector to keep in sync. Anything you forget to tag stays masked.

When an element is inside both a mask (`masking.selectors` or `data-csr-mask`) and `data-csr-unmask`, the nearer one wins, so you can nest them in either direction:

```html
<section data-csr-unmask>
  <h2>Order summary</h2>
  <!-- recorded -->
  <span data-csr-mask>Jane Doe</span>
  <!-- masked -->
</section>
<section class="pii">
  <h2 data-csr-unmask>Order summary</h2>
  <!-- recorded -->
  <p>Jane Doe</p>
  <!-- masked -->
</section>
```

The `text` level also masks `value` on `<option>` elements and on submit and button inputs. `data-csr-unmask` applies inside a component's shadow DOM. Add it in the markup a component first renders: text recorded before the attribute was added stays masked in the replay.

### Masking attributes

Wherever text is masked, the values of `title`, `placeholder`, `aria-label` and `alt` on the same elements are masked too. Other attributes, such as `href` or your own `data-*` attributes, are recorded as-is. To mask more, list them in `masking.attributes`. Listed attributes are masked on every element, whether or not its text is masked, except under a nearer `data-csr-unmask`.

### Migrating from flat options

`maskSelectors`, `blockSelectors` and `maskInputs` still work but are deprecated:

| Deprecated              | Use instead                                  |
| ----------------------- | -------------------------------------------- |
| `maskSelectors: [...]`  | `masking: { selectors: [...] }`              |
| `blockSelectors: [...]` | `blocking: { selectors: [...] }`             |
| `maskInputs: true`      | `masking: { level: 'inputs' }` (the default) |
| `maskInputs: false`     | `masking: { level: 'none' }`                 |

If both forms are set, `masking` and `blocking` win. Using a deprecated option logs a note through `debugLogger`.

## Offline privacy review

Check locally what the recorder captures before you ship. The `@spotify-confidence/session-recording/privacy-review` entry point uses the same recorder and masking options as `initSessionRecorder`, but creates no backend session and uploads no events. It is a separate entry point: importing `@spotify-confidence/session-recording` does not include it, so it adds nothing to production bundles unless you import it.

### Use on a temporary test page

Add the built-in floating controls to a temporary test page or local-only build of your app. The controls are excluded from capture. Remove the setup after the review; it is not intended as a runtime mode switch in a shipped app.

```typescript
import { mountPrivacyReviewControls } from '@spotify-confidence/session-recording/privacy-review';

mountPrivacyReviewControls({
  masking: { level: 'text', selectors: ['.pii'] },
  blocking: { selectors: ['.third-party-widget'] },
});
```

Call this after `document.body` exists, using the same masking and blocking options you want to verify. The returned controller has `destroy()` for cleanup. If your Content Security Policy requires a nonce for injected styles, pass `styleNonce`. Do not initialize the normal session recorder on that test page; it uploads recordings.

The panel offers Start recording, Stop & preview, and Download review. The downloaded HTML file contains both the recording and viewer, and opens directly on the reviewer's machine. The viewer blocks remote assets and network connections, so some recorded visuals may be incomplete. The file contains captured page data until the reviewer deletes it.

### Custom controls

```typescript
import { startPrivacyReviewRecording } from '@spotify-confidence/session-recording/privacy-review';

const review = startPrivacyReviewRecording({
  masking: { level: 'text', selectors: ['.pii'] },
  blocking: { selectors: ['.third-party-widget'] },
});

// Call from a button click or another user gesture after the test journey:
await review.preview();

// Optionally save a self-contained copy of the same recording:
review.download();
```

`preview()` opens a local tab and resolves to `'opened'`. It resolves to `'empty'`, without opening a tab, if nothing replayable has been captured yet. It resolves to `'popup-blocked'` or `'viewer-blocked'` if the browser blocks the tab or its Content Security Policy prevents replay; in that case, download the review and open the HTML file directly. `review.stop()` returns the captured events without downloading them. This review covers DOM capture and its masking and blocking rules; it does not include backend eligibility, session context, tags, measures, or flag metadata from the normal SDK.

### Leak report

The review also scans the recording for values that still look like personal data: email addresses, phone numbers, card numbers (Luhn-checked), IBANs, JWTs, and credentials in URL parameters such as `?token=`. The viewer lists each finding with the element it came from, a button that jumps to that moment in the replay, and a suggested fix. It also shows a suggested config, with a button to copy it. The panel reports how many values were found when you preview.

The scan runs locally, on the recording only. It matches common formats, so an empty report does not prove a page is clean: still watch the replay. The suggested config only contains id or class selectors; for elements without one, the report tells you to add `data-csr-mask`.

The same scan is available for your own tooling:

```typescript
import { findPotentialPii, suggestMaskingConfig } from '@spotify-confidence/session-recording/privacy-review';

const findings = findPotentialPii(review.stop()); // or review.findings()
const config = suggestMaskingConfig(findings); // { masking: { selectors, attributes, level? } }
```

## Context

Context lets you attach custom dimensions to the recording session. These are sent alongside the auto-collected browser metadata (user agent, OS, viewport, language, timezone) in the session init request. Context serves two purposes: it helps you find and filter recordings later, and the backend uses it to target recordings to specific cohorts of your user population (e.g. only record premium users, or users on a specific build version).

```typescript
const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
  context: {
    visitor_id: 'user-42',
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
  context: { visitor_id: 'user-42', buildVersion: '2.3.1' },

  // Privacy
  masking: { level: 'inputs', selectors: ['.pii'] }, // level default: 'inputs'
  blocking: { selectors: ['video'] },

  // Capture options
  captureConsoleLogs: true, // capture raw browser console output (default: false)
  captureNetworkRequests: false, // capture raw fetch/XHR metadata (default: false)
  captureRouteChanges: true, // capture client-side route changes (default: true)

  // Recording mode
  mode: 'automatic', // 'automatic' (default) or 'manual'

  // CSP: self-hosted worker (only needed when data: and blob: are blocked)
  // workerUrl: '/confidence-worker.js',

  // Debug
  debugLogger: msg => console.log(msg), // lifecycle/transport messages (default: off, or console.log when CSR_DEBUG is set in sessionStorage)
});
```

### Sanitizing console and network capture

Raw URLs and console output can contain sensitive data from first-party or third-party code. Existing capture settings
preserve their current behavior and record raw values, so select a sanitization policy before you enable these channels
in production.

Set `sanitize: true` to remove query strings and fragments from captured network URLs and from URLs in console payloads
and stack traces:

```typescript
const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
  captureNetworkRequests: { sanitize: true },
  captureConsoleLogs: { levels: ['warn', 'error'], sanitize: true },
});
```

For application-specific data, provide a function. Network sanitizers receive the request URL. Console sanitizers run
once for each captured payload and trace string. The built-in sanitizer changes only URL-like text. Use a function to
remove secrets stored in other console data.

```typescript
const redactSecrets = (value: string) => value.replace(/client_secret=[^&\s]+/g, 'client_secret=[REDACTED]');

const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
  captureNetworkRequests: { sanitize: redactSecrets },
  captureConsoleLogs: { levels: ['warn', 'error'], sanitize: redactSecrets },
});
```

Sanitizers run before captured data leaves the recorder. If a sanitizer throws or returns a non-string value, the
affected capture event is dropped. The application request or console call continues unchanged. When `CSR_DEBUG` is set
in `sessionStorage`, the SDK logs a prominent `SECURITY` warning without logging the unsanitized value.

## Using with the Confidence flags SDK

If you use both session recording and the Confidence SDK (or an OpenFeature provider) for feature flags, try your best to keep the contexts aligned. Aligning the contexts will make sense when using the Confidence app to set up targeting on recording rules and flag rules. Matching contexts will let you set up policies like "record sessions for users in the `beta` environment" or "only record premium users" without surprises.

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

## Debug logging

The SDK can emit one-line lifecycle and transport messages to help you verify your setup and diagnose issues.

### Option 1: pass a logger

```typescript
const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
  debugLogger: msg => console.log(msg),
});
```

All messages are prefixed with `[CSR]` — you can filter your browser console to quickly find them.

### Option 2: sessionStorage flag

If you can't (or don't want to) change code, open your browser DevTools console and run:

```javascript
sessionStorage.setItem('CSR_DEBUG', 'true');
```

Then reload the page. The SDK will detect the flag and log to `console.log` automatically. Remove it with `sessionStorage.removeItem('CSR_DEBUG')` when you're done.

> **Tip:** We recommend enabling debug logging when first integrating the SDK. It lets you confirm that a session is established, events are flowing, and the backend is reachable — all before you open the Confidence dashboard.

## Content Security Policy (CSP)

The SDK runs its upload logic in a Web Worker. By default it loads the worker from a `data:` URL, which requires no setup but may be blocked by strict Content Security Policies.

### Required directives

| Directive     | Value                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| `worker-src`  | `data:` (default), or `blob:` (automatic fallback), or `'self'` (see below) |
| `connect-src` | `https://recording.confidence.dev wss://recording-ws.confidence.dev`        |

### If `data:` is blocked

The SDK automatically falls back to a `blob:` URL. Most CSPs already allow `blob:` in `worker-src` — if yours does, no action is needed.

### If both `data:` and `blob:` are blocked

Self-host the worker script. The package ships a standalone file you can copy to your static assets:

**Option A: copy from `node_modules`**

```bash
# After install, copy the worker to your public directory
cp node_modules/@spotify-confidence/session-recording/dist/confidence-worker.js public/
```

**Option B: build-tool integration (Vite, webpack, etc.)**

```typescript
import { workerScript } from '@spotify-confidence/session-recording/worker';
import { writeFileSync } from 'fs';

// In a build plugin or script — write the worker to your output directory
writeFileSync('dist/confidence-worker.js', workerScript);
```

**Option C: serve via a route (Express, Next.js API route, etc.)**

```typescript
import { workerScript } from '@spotify-confidence/session-recording/worker';

app.get('/confidence-worker.js', (req, res) => {
  res.type('application/javascript').send(workerScript);
});
```

Then pass the URL:

```typescript
const recorder = initSessionRecorder({
  clientSecret: '<your-client-secret>',
  workerUrl: '/confidence-worker.js',
});
```

Your CSP only needs `worker-src 'self'` with this setup.

> **Note:** The worker file must stay in sync with the SDK. After upgrading `@spotify-confidence/session-recording`, re-copy or re-deploy the worker file. If they're out of sync, the SDK logs a `WORKER MISMATCH` warning via `debugLogger`.

### Troubleshooting

If recording silently fails, open DevTools and look for:

- A `SecurityError` mentioning `worker-src` — your CSP blocks the worker. Use one of the options above.
- A blocked `connect-src` request to `recording.confidence.dev` — add the hosts to your CSP.
- A `WORKER MISMATCH` log — your self-hosted `confidence-worker.js` is outdated. Re-copy it from `node_modules/@spotify-confidence/session-recording/dist/`.

Enable [debug logging](#debug-logging) to see the full lifecycle and pinpoint where it fails.

## Manual mode

Use `manual` mode to control when recording starts — useful for gating on user consent or feature flags.
Calling `start()` uses the same backend eligibility, targeting, allocation, sampling, and admission checks as automatic mode, so the backend may still decide not to record.

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
