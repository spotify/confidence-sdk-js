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

export const RESCAN_DEBOUNCE_MS = 500;

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
  private mo: MutationObserver | null = null;
  private rescanTimer: ReturnType<typeof setTimeout> | null = null;
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
    if (this.io) return;
    if (typeof IntersectionObserver === 'undefined') return;
    this.io = new IntersectionObserver(entries => this.onEntries(entries), {
      threshold: THRESHOLDS,
    });
    this.scan();
    if (typeof MutationObserver !== 'undefined' && this.doc.documentElement) {
      this.mo = new MutationObserver(() => this.scheduleRescan());
      this.mo.observe(this.doc.documentElement, { childList: true, subtree: true });
    }
  }

  stop(): void {
    this.io?.disconnect();
    this.io = null;
    this.mo?.disconnect();
    this.mo = null;
    if (this.rescanTimer !== null) {
      clearTimeout(this.rescanTimer);
      this.rescanTimer = null;
    }
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

  private scheduleRescan(): void {
    if (this.rescanTimer !== null) return;
    this.rescanTimer = setTimeout(() => {
      this.rescanTimer = null;
      this.rescan();
    }, RESCAN_DEBOUNCE_MS);
  }

  private rescan(): void {
    if (!this.io) return;
    // Close out elements that left the DOM: rrweb has recorded their removal,
    // so the analyzer's mirror drops them — emit the final invisible state so
    // the timeline's last word matches.
    const changes: VisibilityChange[] = [];
    for (const el of [...this.observed]) {
      if (el.isConnected) continue;
      this.observed.delete(el);
      this.io.unobserve(el);
      const id = this.getNodeId(el);
      if (id !== -1 && this.visibleState.get(id) === true) {
        this.visibleState.set(id, false);
        changes.push({ id, visible: false, ratio: 0 });
      }
      // The visibleState entry is retained on purpose: if an element with the
      // same id reappears, the retained `false` means it emits only on a
      // transition to visible, not a duplicate baseline.
    }
    if (changes.length > 0) {
      this.emit({ plugin: 'csr:elementVisibility', payload: { changes } });
    }
    this.scan();
  }

  private onEntries(entries: IntersectionObserverEntry[]): void {
    const changes: VisibilityChange[] = [];
    for (const e of entries) {
      const id = this.getNodeId(e.target);
      if (id === -1) continue;
      // Assumes `isIntersecting === false` means the element is genuinely
      // off-screen: browsers never deliver `isIntersecting: false` together
      // with a qualifying ratio or intersection rect.
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
