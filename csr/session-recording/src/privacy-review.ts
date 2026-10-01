import { record, type RecordingConfig } from '@spotify-confidence/csr-recorder';
import type { RecordingEvent } from '@spotify-confidence/csr-common';
import { viewerHtml } from './privacy-review-viewer.generated';

export { mountPrivacyReviewControls } from './privacy-review-controls';
export type { PrivacyReviewControls, PrivacyReviewControlsOptions } from './privacy-review-controls';

export type PrivacyReviewOptions = RecordingConfig;

export interface PrivacyReviewRecording {
  /** Stop capture and return the locally captured DOM events. */
  stop(): RecordingEvent[];
  /** Stop capture and open a local replay tab. Resolves false if the browser blocks the tab or replay. */
  preview(): Promise<boolean>;
  /** Stop capture and save a self-contained HTML review that opens locally. */
  download(filename?: string): void;
  readonly isRecording: boolean;
}

function reviewHtmlBlob(events: RecordingEvent[]): Blob {
  // JSON in an HTML script element must not contain a literal closing tag.
  const data = JSON.stringify({ format: 'csr-privacy-review-v1', events }).replaceAll('<', '\\u003c');
  const html = viewerHtml.replace('<!-- EMBEDDED_RECORDING -->', () => {
    return `<script id="embedded-recording" type="application/json">${data}</script>`;
  });
  return new Blob([html], { type: 'text/html;charset=utf-8' });
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
  const stopCapture = record(event => {
    if (recording) events.push(event);
  }, options);

  const stop = () => {
    if (recording) {
      recording = false;
      stopCapture();
    }
    return events;
  };

  return {
    stop,
    preview() {
      const url = URL.createObjectURL(reviewHtmlBlob(stop()));
      const opened = window.open(url, '_blank');
      if (!opened) {
        URL.revokeObjectURL(url);
        return Promise.resolve(false);
      }
      opened.opener = null;
      const revoke = () => URL.revokeObjectURL(url);
      window.addEventListener('pagehide', revoke, { once: true });
      const deadline = Date.now() + 5_000;
      return new Promise<boolean>(resolve => {
        const check = () => {
          if (opened.closed) {
            window.removeEventListener('pagehide', revoke);
            revoke();
            resolve(false);
            return;
          }
          try {
            if (opened.location.href === url) {
              if (opened.document.documentElement?.dataset.privacyReviewReady === 'true') {
                resolve(true);
                return;
              }
              if (opened.document.readyState === 'complete') {
                opened.close();
                window.removeEventListener('pagehide', revoke);
                revoke();
                resolve(false);
                return;
              }
            }
          } catch {
            // The new tab may still be navigating; let the deadline handle it.
          }
          if (Date.now() >= deadline) {
            opened.close();
            window.removeEventListener('pagehide', revoke);
            revoke();
            resolve(false);
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
