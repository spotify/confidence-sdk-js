import type { ElementVisibilityPluginData } from '@spotify-confidence/csr-common';

type VisibilityChange = ElementVisibilityPluginData['payload']['changes'][number];

/**
 * Priority-ordered selector groups. The scan fills the observation budget in
 * this order, so page structure (sections, landmarks) wins over images when
 * the cap binds. These are the elements the analyzer's a11y tree banding
 * interpolates from — see the design spec.
 */
const PRIORITY_SELECTORS = [
  'main,nav,section,article,aside,header,footer,form,' +
    '[role="main"],[role="navigation"],[role="region"],[role="banner"],' +
    '[role="contentinfo"],[role="complementary"],[role="search"]',
  'h1,h2,h3,h4,h5,h6',
  'dialog,[role="alert"],[role="status"],[role="dialog"],[role="alertdialog"]',
  'img',
];

const DEFAULT_MAX_OBSERVED = 300;
/**
 * Fine-grained thresholds so the "covers half the viewport" clause below gets
 * a callback even for elements many times taller than the viewport (whose
 * intersection ratio can never reach 0.5).
 */
const THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

export interface ElementVisibilityTrackerOptions {
  /** rrweb node id lookup; returns -1 for unserialized nodes. */
  getNodeId: (node: Node) => number;
  emit: (data: ElementVisibilityPluginData) => void;
  /** Elements matching this selector, or inside one, are never observed. */
  blockSelector?: string;
  maxObserved?: number;
  doc?: Document;
}

export class ElementVisibilityTracker {
  private readonly getNodeId: (node: Node) => number;
  private readonly emit: (data: ElementVisibilityPluginData) => void;
  private readonly blockSelector: string | undefined;
  private readonly maxObserved: number;
  private readonly doc: Document;

  private io: IntersectionObserver | null = null;
  private observed = new Set<Element>();
  /** Last emitted state per rrweb node id. Absent = no baseline emitted yet. */
  private visibleState = new Map<number, boolean>();

  constructor(options: ElementVisibilityTrackerOptions) {
    this.getNodeId = options.getNodeId;
    this.emit = options.emit;
    this.blockSelector = options.blockSelector;
    this.maxObserved = options.maxObserved ?? DEFAULT_MAX_OBSERVED;
    this.doc = options.doc ?? document;
  }

  start(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.io = new IntersectionObserver(entries => this.onEntries(entries), {
      threshold: THRESHOLDS,
    });
    this.scan();
  }

  stop(): void {
    this.io?.disconnect();
    this.io = null;
    this.observed.clear();
    this.visibleState.clear();
  }

  /** Observe not-yet-observed candidates until the budget is exhausted. */
  protected scan(): void {
    if (!this.io) return;
    for (const selector of PRIORITY_SELECTORS) {
      if (this.observed.size >= this.maxObserved) return;
      for (const el of this.doc.querySelectorAll(selector)) {
        if (this.observed.size >= this.maxObserved) return;
        if (this.observed.has(el)) continue;
        if (this.blockSelector && el.closest(this.blockSelector)) continue;
        this.observed.add(el);
        this.io.observe(el);
      }
    }
  }

  private onEntries(entries: IntersectionObserverEntry[]): void {
    const changes: VisibilityChange[] = [];
    for (const e of entries) {
      const id = this.getNodeId(e.target);
      if (id === -1) continue;
      const visible =
        e.isIntersecting &&
        (e.intersectionRatio >= 0.5 ||
          (e.rootBounds !== null && e.intersectionRect.height >= e.rootBounds.height * 0.5));
      const prev = this.visibleState.get(id);
      // First report for this id is always emitted — it is the baseline the
      // analyzer needs to distinguish "observed but never visible" from
      // "never observed".
      if (prev === undefined || visible !== prev) {
        this.visibleState.set(id, visible);
        changes.push({ id, visible, ratio: e.intersectionRatio });
      }
    }
    if (changes.length > 0) {
      this.emit({ plugin: 'csr:elementVisibility', payload: { changes } });
    }
  }
}
