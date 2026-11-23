import {
  DEFAULT_BLOCK_SELECTORS,
  DEFAULT_MASK_SELECTORS,
  record,
  type RecordingConfig,
} from '@spotify-confidence/csr-recorder';
import type { ClientContext } from '@spotify-confidence/csr-common/uploader';
import { resolvePrivacyOptions, type MaskingLevel, type PrivacyOptions } from '../privacy-options';
import type { ReviewCaptureOptions } from '../local-review';
import { IncrementalSource, RecordingEventType, type RecordingEvent } from '@spotify-confidence/csr-common';
import { viewerHtml } from './privacy-review-viewer.generated';
import { findPotentialPii, suggestMaskingConfig, type PiiFinding } from './scanner';

/**
 * The same `masking`, `blocking` and capture options as `initSessionRecorder`, so a review
 * matches production. Console and network capture stay off unless enabled, as in production.
 */
export interface PrivacyReviewOptions extends PrivacyOptions, ReviewCaptureOptions {
  /** Session context to show in the review; `initSessionRecorder` passes the one it would have sent. */
  context?: ClientContext;
  debugLogger?: (message: string) => void;
}

/** The review panel's own element, blocked from capture and left out of the config shown in reviews. */
export const REVIEW_PANEL_SELECTOR = '[data-confidence-privacy-review-controls]';

/** The privacy settings a review records with, defaults included, as shown in the viewer. */
export interface EffectivePrivacyConfig {
  masking: { level: MaskingLevel; selectors: string[]; attributes: string[] };
  blocking: { selectors: string[] };
  capture: {
    consoleLogs: CaptureSummary & { levels?: string[] };
    networkRequests: CaptureSummary;
    routeChanges: boolean;
  };
}

/** `sanitize` is `'built-in'` for `sanitize: true` and `'custom'` for a sanitizer function. */
export type CaptureSummary = { enabled: boolean; sanitize?: 'none' | 'built-in' | 'custom' };

function captureSummary(option: boolean | { sanitize?: boolean | ((value: string) => string) } | undefined) {
  if (!option) return { enabled: false };
  const sanitize = option === true ? undefined : option.sanitize;
  let mode: CaptureSummary['sanitize'] = 'none';
  if (typeof sanitize === 'function') mode = 'custom';
  else if (sanitize) mode = 'built-in';
  return { enabled: true, sanitize: mode };
}

function effectiveConfig(resolved: RecordingConfig, capture: ReviewCaptureOptions): EffectivePrivacyConfig {
  const consoleOption = capture.captureConsoleLogs;
  const levels = typeof consoleOption === 'object' ? consoleOption.levels : undefined;
  let level: MaskingLevel = 'none';
  if (resolved.maskAllText) level = 'text';
  else if (resolved.maskInputs) level = 'inputs';
  return {
    masking: {
      level,
      selectors: resolved.maskSelectors ?? DEFAULT_MASK_SELECTORS,
      attributes: resolved.maskAttributes ?? [],
    },
    blocking: {
      selectors: (resolved.blockSelectors ?? DEFAULT_BLOCK_SELECTORS).filter(s => s !== REVIEW_PANEL_SELECTOR),
    },
    capture: {
      consoleLogs: { ...captureSummary(consoleOption), ...(consoleOption && levels && { levels }) },
      networkRequests: captureSummary(capture.captureNetworkRequests),
      routeChanges: capture.captureRouteChanges ?? true,
    },
  };
}

type ReviewMetadata = { context?: ClientContext; config: EffectivePrivacyConfig };

/**
 * `empty`: nothing replayable was captured yet, so no tab was opened.
 * `popup-blocked` / `viewer-blocked`: the browser blocked the tab or the replay; download instead.
 */
export type PrivacyReviewPreviewResult = 'opened' | 'empty' | 'popup-blocked' | 'viewer-blocked';

export interface PrivacyReviewRecording {
  /** Add an event to the recording while it is capturing, e.g. a tag the recorder would upload. */
  addEvent(event: RecordingEvent): void;
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

function reviewHtmlBlob(events: RecordingEvent[], metadata: ReviewMetadata): Blob {
  // JSON in an HTML script element must not contain a literal closing tag.
  const findings = safeFindings(events);
  const suggestion = suggestMaskingConfig(findings);
  const data = JSON.stringify({
    format: 'csr-privacy-review-v1',
    events,
    findings,
    suggestion,
    ...metadata,
  }).replaceAll('<', '\\u003c');
  const html = viewerHtml.replace('<!-- EMBEDDED_RECORDING -->', () => {
    return `<script id="embedded-recording" type="application/json">${data}</script>`;
  });
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

// Interactions rrweb couldn't map to a node (id -1), such as clicks inside the review panel's
// shadow root, can't be replayed; in a review they are only noise.
function isUnmappedInteraction(event: RecordingEvent): boolean {
  if (event.type !== RecordingEventType.IncrementalSnapshot) return false;
  const data = event.data as { source?: number; id?: number };
  return (
    data.id === -1 && (data.source === IncrementalSource.MouseInteraction || data.source === IncrementalSource.Input)
  );
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
  const { debugLogger, context, captureConsoleLogs, captureNetworkRequests, captureRouteChanges, parameterizeRoute } =
    options;
  const capture = { captureConsoleLogs, captureNetworkRequests, captureRouteChanges, parameterizeRoute };
  const resolved = resolvePrivacyOptions(options, debugLogger);
  const metadata: ReviewMetadata = { context, config: effectiveConfig(resolved, capture) };
  const stopCapture = record(
    event => {
      if (recording && !isUnmappedInteraction(event)) events.push(event);
    },
    { ...resolved, ...capture, debugLogger },
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
    addEvent(event) {
      if (recording) events.push(event);
    },
    findings: () => safeFindings(events),
    preview() {
      const captured = stop();
      if (!hasFullSnapshot(captured)) return Promise.resolve('empty');
      const url = URL.createObjectURL(reviewHtmlBlob(captured, metadata));
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
      saveBlob(reviewHtmlBlob(stop(), metadata), filename);
    },
    get isRecording() {
      return recording;
    },
  };
}
