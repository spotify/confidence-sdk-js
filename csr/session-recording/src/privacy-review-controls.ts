import { DEFAULT_BLOCK_SELECTORS } from '@spotify-confidence/csr-recorder';
import { startPrivacyReviewRecording, type PrivacyReviewOptions, type PrivacyReviewRecording } from './privacy-review';

const CONTROL_SELECTOR = '[data-confidence-privacy-review-controls]';

export interface PrivacyReviewControlsOptions extends PrivacyReviewOptions {
  /** Nonce for the panel's stylesheet when the application uses a style-src nonce. */
  styleNonce?: string;
}

export interface PrivacyReviewControls {
  /** Stop any active capture and remove the panel. */
  destroy(): void;
}

/** Add a local review panel to a temporary test page or local-only build. */
export function mountPrivacyReviewControls(options: PrivacyReviewControlsOptions = {}): PrivacyReviewControls {
  const { styleNonce, ...recordingOptions } = options;
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
      font: 14px/1.4 system-ui, sans-serif; }
    strong { display: block; margin-bottom: 4px; font-size: 15px; }
    p { margin: 0 0 10px; }
    .buttons { display: flex; flex-wrap: wrap; gap: 6px; }
    button { padding: 7px 9px; border: 1px solid #577661; border-radius: 7px; background: #f5f8f2;
      color: #17382c; font: inherit; cursor: pointer; }
    button:disabled { opacity: .5; cursor: default; }
    [role=status] { margin: 9px 0 0; font-size: 12px; }
  `;
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <strong>Privacy review</strong>
    <p>Record a short journey and replay it locally. Nothing is sent to Confidence.</p>
    <div class="buttons">
      <button type="button" id="start">Start recording</button>
      <button type="button" id="preview" disabled>Stop &amp; preview</button>
      <button type="button" id="download" disabled>Download review</button>
    </div>
    <p role="status" id="status">Ready to record.</p>
  `;
  shadow.append(style, panel);
  document.body.appendChild(host);

  const start = shadow.querySelector<HTMLButtonElement>('#start')!;
  const preview = shadow.querySelector<HTMLButtonElement>('#preview')!;
  const download = shadow.querySelector<HTMLButtonElement>('#download')!;
  const status = shadow.querySelector<HTMLElement>('#status')!;
  let review: PrivacyReviewRecording | undefined;

  start.addEventListener('click', () => {
    review = startPrivacyReviewRecording({
      ...recordingOptions,
      blockSelectors: [...(recordingOptions.blockSelectors ?? DEFAULT_BLOCK_SELECTORS), CONTROL_SELECTOR],
    });
    start.disabled = true;
    preview.disabled = false;
    download.disabled = false;
    status.textContent = 'Recording locally. Explore the page, then preview it.';
  });

  preview.addEventListener('click', () => {
    if (!review) return;
    const opened = review.preview();
    start.disabled = false;
    preview.disabled = true;
    status.textContent = opened
      ? 'Preview opened in a new tab. Download a copy if you want to keep it.'
      : 'Your browser blocked the preview tab. Download the review to open it locally.';
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
    destroy() {
      review?.stop();
      review = undefined;
      host.remove();
    },
  };
}
