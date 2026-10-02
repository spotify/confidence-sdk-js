# @spotify-confidence/privacy-review

Local review of what the Confidence session recorder captures. This package uses the same masking and blocking options as `@spotify-confidence/session-recording`, but creates no backend session and uploads no events.

## Installation

```bash
npm install @spotify-confidence/privacy-review
```

## Use on a temporary test page

Add the built-in floating controls to a temporary test page or local-only build of your app. The controls are excluded from capture. Remove the setup after the review; it is not intended as a runtime mode switch in a shipped app.

```typescript
import { mountPrivacyReviewControls } from '@spotify-confidence/privacy-review';

mountPrivacyReviewControls({
  maskSelectors: ['.pii'],
  blockSelectors: ['.third-party-widget'],
  maskInputs: true,
});
```

Call this after `document.body` exists, using the same masking and blocking options you want to verify. The returned controller has `destroy()` for cleanup. If your Content Security Policy requires a nonce for injected styles, pass `styleNonce`. Do not initialize the normal session recorder on that test page; it uploads recordings.

The panel offers Start recording, Stop & preview, and Download review. The downloaded HTML file contains both the recording and viewer, and opens directly on the reviewer's machine. The viewer blocks remote assets and network connections, so some recorded visuals may be incomplete. The file contains captured page data until the reviewer deletes it.

## Custom controls

```typescript
import { startPrivacyReviewRecording } from '@spotify-confidence/privacy-review';

const review = startPrivacyReviewRecording({
  maskSelectors: ['.pii'],
  blockSelectors: ['.third-party-widget'],
  maskInputs: true,
});

// Call from a button click or another user gesture after the test journey:
await review.preview();

// Optionally save a self-contained copy of the same recording:
review.download();
```

`preview()` opens a local tab and resolves to `false` if the browser blocks the tab or its Content Security Policy prevents replay. In that case, download the review and open the HTML file directly. `review.stop()` returns the captured events without downloading them. This review covers DOM capture and its masking and blocking rules; it does not include backend eligibility, session context, tags, measures, or flag metadata from the normal SDK.
