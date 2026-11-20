import { record } from '@spotify-confidence/csr-recorder';
import { resolvePrivacyOptions, type PrivacyOptions } from '../privacy-options';
import type { RecordingEvent } from '@spotify-confidence/csr-common';
import { viewerHtml } from './privacy-review-viewer.generated';
import { findPotentialPii, suggestMaskingConfig, type PiiFinding } from './scanner';

/** The same `masking` and `blocking` options as `initSessionRecorder`, so a review matches production. */
export interface PrivacyReviewOptions extends PrivacyOptions {
  debugLogger?: (message: string) => void;
}

/**
 * `empty`: nothing replayable was captured yet, so no tab was opened.
 * `popup-blocked` / `viewer-blocked`: the browser blocked the tab or the replay; download instead.
 */
export type PrivacyReviewPreviewResult = 'opened' | 'empty' | 'popup-blocked' | 'viewer-blocked';

export interface PrivacyReviewRecording {
  /** Values in the recording so far that look like personal data. See `findPotentialPii`. */
  findings(): PiiFinding[];
  /** Stop capture and return the locally captured DOM events. */
  stop(): RecordingEvent[];
  /** Stop capture and open a local replay tab. */
  preview(): Promise<PrivacyReviewPreviewResult>;
  /** Stop capture and save a self-contained HTML review that opens locally. */
  download(filename?: string): void;
  readonly isRecording: boolean;
}

// The leak report is an aid; a scanner bug must never stop the review itself.
function safeFindings(events: RecordingEvent[]): PiiFinding[] {
  try {
    return findPotentialPii(events);
  } catch (_error) {
    return [];
  }
}

function reviewHtmlBlob(events: RecordingEvent[]): Blob {
  // JSON in an HTML script element must not contain a literal closing tag.
  const findings = safeFindings(events);
  const suggestion = suggestMaskingConfig(findings);
  const data = JSON.stringify({ format: 'csr-privacy-review-v1', events, findings, suggestion }).replaceAll(
    '<',
    '\\u003c',
  );
  const html = viewerHtml.replace('<!-- EMBEDDED_RECORDING -->', () => {
    return `<script id="embedded-recording" type="application/json">${data}</script>`;
  });
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

// rrweb cannot replay without a full DOM snapshot (event type 2).
function hasFullSnapshot(events: RecordingEvent[]): boolean {
  return events.some(event => event.type === 2);
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Capture a short recording entirely in this browser tab, without creating a backend session. */
export function startPrivacyReviewRecording(options: PrivacyReviewOptions = {}): PrivacyReviewRecording {
  const events: RecordingEvent[] = [];
  let recording = true;
  const { debugLogger } = options;
  const stopCapture = record(
    event => {
      if (recording) events.push(event);
    },
    { ...resolvePrivacyOptions(options, debugLogger), debugLogger },
  );

  const stop = () => {
    if (recording) {
      recording = false;
      stopCapture();
    }
    return events;
  };

  return {
    stop,
    findings: () => safeFindings(events),
    preview() {
      const captured = stop();
      if (!hasFullSnapshot(captured)) return Promise.resolve('empty');
      const url = URL.createObjectURL(reviewHtmlBlob(captured));
      const opened = window.open(url, '_blank');
      if (!opened) {
        URL.revokeObjectURL(url);
        return Promise.resolve('popup-blocked');
      }
      opened.opener = null;
      const revoke = () => URL.revokeObjectURL(url);
      window.addEventListener('pagehide', revoke, { once: true });
      const deadline = Date.now() + 5_000;
      return new Promise<PrivacyReviewPreviewResult>(resolve => {
        const check = () => {
          if (opened.closed) {
            window.removeEventListener('pagehide', revoke);
            revoke();
            resolve('viewer-blocked');
            return;
          }
          try {
            if (opened.location.href === url) {
              if (opened.document.documentElement?.dataset.privacyReviewReady === 'true') {
                resolve('opened');
                return;
              }
              if (opened.document.readyState === 'complete') {
                opened.close();
                window.removeEventListener('pagehide', revoke);
                revoke();
                resolve('viewer-blocked');
                return;
              }
            }
          } catch (_error) {
            // The new tab may still be navigating; let the deadline handle it.
          }
          if (Date.now() >= deadline) {
            opened.close();
            window.removeEventListener('pagehide', revoke);
            revoke();
            resolve('viewer-blocked');
          } else {
            setTimeout(check, 50);
          }
        };
        setTimeout(check, 0);
      });
    },
    download(filename = 'confidence-privacy-review.html') {
      saveBlob(reviewHtmlBlob(stop()), filename);
    },
    get isRecording() {
      return recording;
    },
  };
}
