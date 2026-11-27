import { DEFAULT_BLOCK_SELECTORS, DEFAULT_MASK_SELECTORS, type RecordingConfig } from '../types';

// The masking decisions shared by the recorder and the privacy review's live overlay.

const UNMASK_SELECTOR = '[data-csr-unmask]';

export function maskWithStars(text: string): string {
  return text.replace(/\S/g, '*');
}

// nodeType, not instanceof, so nodes inside same-origin iframes are recognised.
export function isElement(node: unknown): node is Element {
  return (node as Node | null)?.nodeType === 1;
}

// Parent element, continuing from a shadow root to its host.
function parentAcrossShadow(element: Element): Element | null {
  const root = element.getRootNode() as Node & { host?: unknown };
  return element.parentElement ?? (isElement(root.host) ? root.host : null);
}

// Levels up to the nearest match (0 = the element itself), or -1 if none within `limit`.
function distanceToMatch(element: Element, selector: string, limit: number = Infinity): number {
  let current: Element | null = element;
  for (let distance = 0; current && distance <= limit; distance++) {
    try {
      if (current.matches(selector)) return distance;
    } catch (_error) {
      // An invalid customer selector must fail closed: treat it as matching.
      return distance;
    }
    current = parentAcrossShadow(current);
  }
  return -1;
}

export type Masking = { maskAllText: boolean; maskSelector: string; maskAttributes: Set<string> };

/** Whether text on this element is masked. Under maskAllText the nearer of mask and unmask wins; ties mask. */
export function isMasked(element: Element | null, { maskAllText, maskSelector }: Masking): boolean {
  if (!element) return maskAllText;
  if (!maskAllText) return maskSelector !== '' && distanceToMatch(element, maskSelector) >= 0;
  const unmaskDistance = distanceToMatch(element, UNMASK_SELECTOR);
  return unmaskDistance < 0 || distanceToMatch(element, maskSelector, unmaskDistance) >= 0;
}

export function maskingFor(config: RecordingConfig, maskSelectors: string[]): Masking {
  const maskAllText = config.maskAllText ?? false;
  // Under maskAllText, data-csr-mask keeps working alongside custom maskSelectors.
  const selectors = maskAllText ? [...new Set([...DEFAULT_MASK_SELECTORS, ...maskSelectors])] : maskSelectors;
  return { maskAllText, maskSelector: selectors.join(','), maskAttributes: new Set(config.maskAttributes) };
}

/** How the recorder would capture one element, for showing a config's effect on a live page. */
export interface ElementPrivacyClassifier {
  /** Whether this element itself matches a block selector (its subtree is then not recorded). */
  isBlocked(element: Element): boolean;
  /** Whether the element's own text would be recorded as stars. */
  isTextMasked(element: Element): boolean;
  /** Whether a typed or pre-filled value of this form control would be masked. */
  isInputMasked(element: Element): boolean;
}

/** Classify elements with the same rules, defaults and fail-closed handling the recorder uses. */
export function createElementPrivacyClassifier(config: RecordingConfig): ElementPrivacyClassifier {
  const masking = maskingFor(config, config.maskSelectors ?? DEFAULT_MASK_SELECTORS);
  const blockSelector = (config.blockSelectors ?? DEFAULT_BLOCK_SELECTORS).join(',');
  const maskInputs = config.maskInputs ?? true;
  return {
    isBlocked(element) {
      if (!blockSelector) return false;
      try {
        return element.matches(blockSelector);
      } catch (_error) {
        return true;
      }
    },
    isTextMasked: element => isMasked(element, masking),
    // rrweb always masks password fields.
    isInputMasked: element =>
      maskInputs || (element.tagName === 'INPUT' && element.getAttribute('type')?.toLowerCase() === 'password'),
  };
}
