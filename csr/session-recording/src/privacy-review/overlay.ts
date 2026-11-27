import type { ElementPrivacyClassifier } from '@spotify-confidence/csr-recorder';
import { REVIEW_PANEL_SELECTOR } from './recorder';

/** `visible`: recorded as-is. `masked`: recorded as stars. `blocked`: not recorded, a placeholder replays instead. */
export type OverlayState = 'visible' | 'masked' | 'blocked';

export type OverlayCounts = Record<OverlayState, number>;

export interface MaskingOverlay {
  stop(): void;
}

type Rect = { left: number; top: number; width: number; height: number };
type Box = { state: OverlayState; rect: Rect };

const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK']);
const NON_VALUE_INPUTS = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio']);
// Button-like inputs show their value as a label, which is masked with text, not with inputs.
const LABEL_INPUTS = new Set(['submit', 'button', 'reset']);
// Drawing is per visible element; past this a page is too dense for outlines to be readable anyway.
const MAX_BOXES = 3000;

function isFormValue(element: Element): boolean {
  if (element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') return true;
  return element.tagName === 'INPUT' && !NON_VALUE_INPUTS.has(inputType(element));
}

function inputType(element: Element): string {
  return (element.getAttribute('type') ?? '').toLowerCase();
}

function hasOwnText(element: Element): boolean {
  if (element.tagName === 'INPUT' && LABEL_INPUTS.has(inputType(element)))
    return Boolean(element.getAttribute('value'));
  for (const child of element.childNodes) {
    if (child.nodeType === 3 && child.textContent?.trim()) return true;
  }
  return false;
}

function onScreen(rect: Rect, view: Window): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top + rect.height > 0 &&
    rect.left + rect.width > 0 &&
    rect.top < view.innerHeight &&
    rect.left < view.innerWidth
  );
}

/** Classify every element on screen, walking into open shadow roots and same-origin iframes. */
export function collectBoxes(doc: Document, classifier: ElementPrivacyClassifier): Box[] {
  const boxes: Box[] = [];
  const view = doc.defaultView ?? window;

  const visit = (element: Element, offsetX: number, offsetY: number) => {
    if (boxes.length >= MAX_BOXES || SKIPPED_TAGS.has(element.tagName)) return;
    if (element.matches(REVIEW_PANEL_SELECTOR)) return;
    const blocked = classifier.isBlocked(element);
    let state: OverlayState | undefined;
    if (blocked) state = 'blocked';
    else if (isFormValue(element)) state = classifier.isInputMasked(element) ? 'masked' : 'visible';
    else if (hasOwnText(element)) state = classifier.isTextMasked(element) ? 'masked' : 'visible';
    if (state) {
      const r = element.getBoundingClientRect();
      const rect = { left: r.left + offsetX, top: r.top + offsetY, width: r.width, height: r.height };
      if (onScreen(rect, view)) boxes.push({ state, rect });
    }
    // A blocked element's subtree isn't recorded at all.
    if (blocked) return;
    if (element.shadowRoot) for (const child of element.shadowRoot.children) visit(child, offsetX, offsetY);
    if (element.tagName === 'IFRAME') {
      try {
        const inner = (element as HTMLIFrameElement).contentDocument?.documentElement;
        if (inner) {
          const frame = element.getBoundingClientRect();
          visit(inner, offsetX + frame.left + element.clientLeft, offsetY + frame.top + element.clientTop);
        }
      } catch (_error) {
        // Cross-origin frames aren't recorded either.
      }
    }
    for (const child of element.children) visit(child, offsetX, offsetY);
  };

  if (doc.body) visit(doc.body, 0, 0);
  return boxes;
}

export const OVERLAY_STYLES = `
  .overlay { position: fixed; inset: 0; pointer-events: none; }
  .box { position: fixed; border-radius: 2px; }
  .box.visible { outline: 2px dashed #d9480f; background: #d9480f14; }
  .box.masked { outline: 2px solid #2f9e44; background: #2f9e4414; }
  .box.blocked { outline: 2px solid #5f3dc4;
    background: repeating-linear-gradient(45deg, #5f3dc433 0 6px, transparent 6px 12px); }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 8px 0 0; font-size: 12px; }
  .legend span::before { content: ''; display: inline-block; width: 10px; height: 10px; margin-right: 4px;
    vertical-align: -1px; border-radius: 2px; }
  .legend .visible::before { outline: 2px dashed #d9480f; }
  .legend .masked::before { outline: 2px solid #2f9e44; }
  .legend .blocked::before { outline: 2px solid #5f3dc4; background: #5f3dc433; }
`;

/** Outline what the recorder would record as-is, mask or block, drawn into `layer` (inside the blocked panel). */
export function startMaskingOverlay(
  layer: HTMLElement,
  classifier: ElementPrivacyClassifier,
  onCounts?: (counts: OverlayCounts) => void,
): MaskingOverlay {
  let frame = 0;

  const draw = () => {
    frame = 0;
    const counts: OverlayCounts = { visible: 0, masked: 0, blocked: 0 };
    const elements = collectBoxes(document, classifier).map(({ state, rect }) => {
      counts[state]++;
      const element = document.createElement('div');
      element.className = `box ${state}`;
      Object.assign(element.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      return element;
    });
    layer.replaceChildren(...elements);
    onCounts?.(counts);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  // The layer lives in the panel's shadow root, so drawing doesn't trigger this observer.
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  draw();

  return {
    stop() {
      observer.disconnect();
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
      layer.replaceChildren();
    },
  };
}
