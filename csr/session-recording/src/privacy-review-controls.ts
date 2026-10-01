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
  buttons.append(start, preview, download);
  const status = document.createElement('p');
  status.id = 'status';
  status.setAttribute('role', 'status');
  status.textContent = 'Ready to record.';
  panel.append(heading, description, buttons, status);
  shadow.append(style, panel);
  document.body.appendChild(host);

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

  preview.addEventListener('click', async () => {
    if (!review) return;
    preview.disabled = true;
    download.disabled = true;
    status.textContent = 'Opening local preview…';
    const opened = await review.preview();
    start.disabled = false;
    download.disabled = false;
    status.textContent = opened
      ? 'Preview opened in a new tab. Download a copy if you want to keep it.'
      : 'Your browser blocked the preview. Download the review to open it locally.';
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
