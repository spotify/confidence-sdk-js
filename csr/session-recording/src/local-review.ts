import type { RecordingEvent } from '@spotify-confidence/csr-common';
import type { ClientContext } from '@spotify-confidence/csr-common/uploader';
import type { RecordingConfig } from '@spotify-confidence/csr-recorder';
import type { PrivacyOptions } from './privacy-options';
import type { SessionRecorder } from './index';
import { observeFlags } from './flag-observer';
import { createFlagSet } from './flag-set';
import { flagEvaluationEvent, measureEvent, tagEvent } from './plugin-events';

/** The non-DOM capture options a review records with, so their events can be checked too. */
export type ReviewCaptureOptions = Pick<
  RecordingConfig,
  'captureConsoleLogs' | 'captureNetworkRequests' | 'captureRouteChanges' | 'parameterizeRoute'
>;

export interface PrivacyReviewPanel {
  /** Add an event (a tag, measure or flag evaluation) to the review if one is recording. */
  addEvent(event: RecordingEvent): void;
  destroy(): void;
}

/**
 * The `privacyReview` export of `@spotify-confidence/session-recording/privacy-review`.
 * Only its type lives here, so the main entry never pulls in the review code.
 */
export interface PrivacyReviewModule {
  mount(
    options: PrivacyOptions &
      ReviewCaptureOptions & {
        /** The session context the recorder would have sent, shown in the review. */
        context?: ClientContext;
        /** Called when a review recording starts, so recorder-level events can be replayed into it. */
        onRecordingStart?: () => void;
        debugLogger?: (message: string) => void;
      },
  ): PrivacyReviewPanel;
}

/**
 * Replace the recorder with a local review: no session is created and nothing is uploaded.
 * Tags, measures and flag evaluations go into the local recording instead, as the same events,
 * and console, network and route capture run with the same options.
 */
export function startLocalReview(
  options: PrivacyOptions & ReviewCaptureOptions & { mode?: string },
  review: PrivacyReviewModule,
  context: ClientContext,
  debugLogger?: (message: string) => void,
): SessionRecorder {
  if (options.mode !== undefined) debugLogger?.(`review is set, so mode '${options.mode}' is ignored`);
  debugLogger?.('Local privacy review: nothing is uploaded');

  let panel: PrivacyReviewPanel | undefined;
  let stopObservingFlags: (() => void) | undefined;
  let stopped = false;
  const flags = createFlagSet(debugLogger);
  const add = (event: RecordingEvent | undefined) => {
    if (event) panel?.addEvent(event);
  };
  const mount = () => {
    if (stopped) return;
    const { masking, blocking, maskSelectors, blockSelectors, maskInputs } = options;
    const { captureConsoleLogs, captureNetworkRequests, captureRouteChanges, parameterizeRoute } = options;
    panel = review.mount({
      masking,
      blocking,
      maskSelectors,
      blockSelectors,
      maskInputs,
      captureConsoleLogs,
      captureNetworkRequests,
      captureRouteChanges,
      parameterizeRoute,
      context,
      debugLogger,
      // observeFlags replays already-evaluated flags, as the real recorder does at session start.
      onRecordingStart: () => {
        stopObservingFlags?.();
        stopObservingFlags = observeFlags(write => add(flagEvaluationEvent(write)));
        flags.all().forEach(write => add(flagEvaluationEvent(write)));
      },
    });
  };

  if (typeof document !== 'undefined') {
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount, { once: true });
  }

  return {
    start() {},
    stop() {
      stopped = true;
      stopObservingFlags?.();
      panel?.destroy();
      panel = undefined;
    },
    tag(key, value) {
      add(tagEvent(key, value, debugLogger));
    },
    measure(key, value) {
      add(measureEvent(key, value, debugLogger));
    },
    setFlags(assignments) {
      flags.set(assignments).forEach(write => add(flagEvaluationEvent(write)));
    },
    get isRecording() {
      return false;
    },
  };
}
