import { createElementPrivacyClassifier, DEFAULT_BLOCK_SELECTORS } from '@spotify-confidence/csr-recorder';
import { resolvePrivacyOptions } from '../privacy-options';
import { OVERLAY_STYLES, startMaskingOverlay, type MaskingOverlay } from './overlay';
import {
  REVIEW_PANEL_SELECTOR,
  startPrivacyReviewRecording,
  type PrivacyReviewOptions,
  type PrivacyReviewRecording,
} from './recorder';
import type { RecordingEvent } from '@spotify-confidence/csr-common';

export interface PrivacyReviewControlsOptions extends PrivacyReviewOptions {
  /** Nonce for the panel's stylesheet when the application uses a style-src nonce. */
  styleNonce?: string;
  /** Called each time a review recording starts. */
  onRecordingStart?: () => void;
}

export interface PrivacyReviewControls {
  /** Add an event (e.g. a tag) to the review if one is recording. */
  addEvent(event: RecordingEvent): void;
  /** Stop any active capture and remove the panel. */
  destroy(): void;
}

/** Add a local review panel to a temporary test page or local-only build. */
export function mountPrivacyReviewControls(options: PrivacyReviewControlsOptions = {}): PrivacyReviewControls {
  const { styleNonce, onRecordingStart, ...recordingOptions } = options;
  const host = document.createElement('div');
  host.setAttribute('data-confidence-privacy-review-controls', '');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  if (styleNonce) style.nonce = styleNonce;
  style.textContent = `
    :host { all: initial; position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; }
    * { box-sizing: border-box; }
    .panel { max-width: min(360px, calc(100vw - 32px)); padding: 14px; border: 1px solid #bed0c0;
      border-radius: 12px; background: #fff; color: #17382c; box-shadow: 0 8px 28px #0003;
      font: 14px/1.4 system-ui, sans-serif; position: relative; z-index: 1; }
    strong { display: block; margin-bottom: 4px; font-size: 15px; }
    p { margin: 0 0 10px; }
    .buttons { display: flex; flex-wrap: wrap; gap: 6px; }
    button { padding: 7px 9px; border: 1px solid #577661; border-radius: 7px; background: #f5f8f2;
      color: #17382c; font: inherit; cursor: pointer; }
    button:disabled { opacity: .5; cursor: default; }
    button.on { background: #17382c; color: #fff; }
    [role=status] { margin: 9px 0 0; font-size: 12px; }
    ${OVERLAY_STYLES}
  `;
  const panel = document.createElement('div');
  panel.className = 'panel';
  const heading = document.createElement('strong');
  heading.textContent = 'Privacy review';
  const description = document.createElement('p');
  description.textContent = 'Record a short journey and replay it locally. Nothing is sent to Confidence.';
  const buttons = document.createElement('div');
  buttons.className = 'buttons';
  const start = document.createElement('button');
  start.id = 'start';
  start.type = 'button';
  start.textContent = 'Start recording';
  const preview = document.createElement('button');
  preview.id = 'preview';
  preview.type = 'button';
  preview.textContent = 'Stop & preview';
  preview.disabled = true;
  const download = document.createElement('button');
  download.id = 'download';
  download.type = 'button';
  download.textContent = 'Download review';
  download.disabled = true;
  const showMasking = document.createElement('button');
  showMasking.id = 'show-masking';
  showMasking.type = 'button';
  showMasking.textContent = 'Show masking';
  buttons.append(start, preview, download, showMasking);
  const legend = document.createElement('p');
  legend.className = 'legend';
  legend.hidden = true;
  const layer = document.createElement('div');
  layer.className = 'overlay';
  const status = document.createElement('p');
  status.id = 'status';
  status.setAttribute('role', 'status');
  status.textContent = 'Ready to record.';
  panel.append(heading, description, buttons, legend, status);
  shadow.append(style, layer, panel);
  document.body.appendChild(host);

  let review: PrivacyReviewRecording | undefined;
  let overlay: MaskingOverlay | undefined;

  // Outlines what this config would record as-is, mask or block on the live page, without recording.
  const classifier = createElementPrivacyClassifier(resolvePrivacyOptions(recordingOptions));
  const legendItem = (state: string, text: string) => {
    const item = document.createElement('span');
    item.className = state;
    item.textContent = text;
    return item;
  };
  showMasking.addEventListener('click', () => {
    if (overlay) {
      overlay.stop();
      overlay = undefined;
      legend.hidden = true;
      showMasking.textContent = 'Show masking';
      showMasking.classList.remove('on');
      return;
    }
    legend.hidden = false;
    showMasking.textContent = 'Hide masking';
    showMasking.classList.add('on');
    overlay = startMaskingOverlay(layer, classifier, counts => {
      legend.replaceChildren(
        legendItem('visible', `Recorded as-is (${counts.visible})`),
        legendItem('masked', `Masked (${counts.masked})`),
        legendItem('blocked', `Blocked (${counts.blocked})`),
      );
    });
  });

  start.addEventListener('click', () => {
    review = startPrivacyReviewRecording({
      ...recordingOptions,
      blocking: {
        selectors: [
          ...(recordingOptions.blocking?.selectors ?? recordingOptions.blockSelectors ?? DEFAULT_BLOCK_SELECTORS),
          REVIEW_PANEL_SELECTOR,
        ],
      },
    });
    onRecordingStart?.();
    start.disabled = true;
    preview.disabled = false;
    download.disabled = false;
    status.textContent = 'Recording locally. Explore the page, then preview it.';
  });

  preview.addEventListener('click', async () => {
    if (!review) return;
    preview.disabled = true;
    download.disabled = true;
    status.textContent = 'Opening local preview…';
    const result = await review.preview();
    start.disabled = false;
    if (result === 'empty') {
      review = undefined;
      status.textContent = 'Nothing was captured yet. Record for a little longer before previewing.';
      return;
    }
    download.disabled = false;
    const leaks = review.findings().length;
    const leakSummary = leaks
      ? ` ${leaks} possible personal data ${leaks === 1 ? 'value was' : 'values were'} recorded; see the review.`
      : ' No common personal data formats were found.';
    status.textContent =
      (result === 'opened'
        ? 'Preview opened in a new tab. Download a copy if you want to keep it.'
        : 'Your browser blocked the preview. Download the review to open it locally.') + leakSummary;
  });

  download.addEventListener('click', () => {
    if (!review) return;
    review.download();
    review = undefined;
    start.disabled = false;
    preview.disabled = true;
    download.disabled = true;
    status.textContent = 'Review saved. Open the HTML file in your browser to replay it.';
  });

  return {
    addEvent(event) {
      review?.addEvent(event);
    },
    destroy() {
      overlay?.stop();
      overlay = undefined;
      review?.stop();
      review = undefined;
      host.remove();
    },
  };
}
