/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ElementVisibilityPluginData } from '@spotify-confidence/csr-common';
import { ElementVisibilityTracker } from './element-visibility';

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed: Element[] = [];
  constructor(
    public cb: IntersectionObserverCallback,
    public options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(el: Element): void {
    this.observed = this.observed.filter(e => e !== el);
  }
  disconnect(): void {
    this.observed = [];
  }
  trigger(entries: Array<Partial<IntersectionObserverEntry> & { target: Element }>): void {
    this.cb(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

/** Elements carry data-test-id; unserialized elements have none and map to -1. */
const getNodeId = (node: Node): number => {
  const raw = (node as Element).getAttribute?.('data-test-id');
  return raw === undefined || raw === null ? -1 : Number(raw);
};

function entry(
  target: Element,
  opts: {
    ratio: number;
    intersecting?: boolean;
    intersectHeight?: number;
    rootHeight?: number;
  },
): Partial<IntersectionObserverEntry> & { target: Element } {
  return {
    target,
    isIntersecting: opts.intersecting ?? opts.ratio > 0,
    intersectionRatio: opts.ratio,
    intersectionRect: { height: opts.intersectHeight ?? 0 } as DOMRectReadOnly,
    rootBounds: { height: opts.rootHeight ?? 900 } as DOMRectReadOnly,
  };
}

describe('ElementVisibilityTracker', () => {
  let emitted: ElementVisibilityPluginData[];
  let tracker: ElementVisibilityTracker | null = null;

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    emitted = [];
    document.body.innerHTML = '';
  });

  afterEach(() => {
    tracker?.stop();
    tracker = null;
    vi.unstubAllGlobals();
  });

  function startTracker(opts?: { blockSelector?: string; maxObserved?: number }): FakeIntersectionObserver {
    tracker = new ElementVisibilityTracker({
      getNodeId,
      emit: data => emitted.push(data),
      ...opts,
    });
    tracker.start();
    return FakeIntersectionObserver.instances[0];
  }

  it('observes sectioning elements, headings, alerts, and images', () => {
    document.body.innerHTML = `
      <main data-test-id="1"><h1 data-test-id="2">Title</h1><p>text</p></main>
      <div role="alert" data-test-id="3">Error</div>
      <img data-test-id="4" alt="hero" />
      <span>not observed</span>
    `;
    const io = startTracker();
    const ids = io.observed.map(el => getNodeId(el)).sort();
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  it('skips elements inside a blocked subtree', () => {
    document.body.innerHTML = `
      <section data-test-id="1"><h2 data-test-id="2">Seen</h2></section>
      <section data-csr-block data-test-id="3"><h2 data-test-id="4">Blocked</h2></section>
    `;
    const io = startTracker({ blockSelector: '[data-csr-block]' });
    const ids = io.observed.map(el => getNodeId(el)).sort();
    expect(ids).toEqual([1, 2]);
  });

  it('respects the observation cap, filling sections before images', () => {
    document.body.innerHTML =
      '<section data-test-id="1"></section>' + '<section data-test-id="2"></section>' + '<img data-test-id="3" />';
    const io = startTracker({ maxObserved: 2 });
    const ids = io.observed.map(el => getNodeId(el)).sort();
    expect(ids).toEqual([1, 2]);
  });

  it('emits a baseline for every observed element on the first callback, including invisible ones', () => {
    document.body.innerHTML = '<section data-test-id="1"></section><section data-test-id="2"></section>';
    const io = startTracker();
    const [a, b] = io.observed;
    io.trigger([entry(a, { ratio: 1, intersecting: true }), entry(b, { ratio: 0, intersecting: false })]);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].payload.changes).toEqual([
      { id: 1, visible: true, ratio: 1 },
      { id: 2, visible: false, ratio: 0 },
    ]);
  });

  it('emits only transitions after the baseline', () => {
    document.body.innerHTML = '<section data-test-id="1"></section>';
    const io = startTracker();
    const [a] = io.observed;
    io.trigger([entry(a, { ratio: 0, intersecting: false })]); // baseline: hidden
    io.trigger([entry(a, { ratio: 0.1, intersecting: true })]); // still not "visible"
    expect(emitted).toHaveLength(1);
    io.trigger([entry(a, { ratio: 0.6, intersecting: true })]); // crosses 0.5
    expect(emitted).toHaveLength(2);
    expect(emitted[1].payload.changes).toEqual([{ id: 1, visible: true, ratio: 0.6 }]);
    io.trigger([entry(a, { ratio: 0.7, intersecting: true })]); // no transition
    expect(emitted).toHaveLength(2);
  });

  it('treats a tall element covering half the viewport as visible despite a low ratio', () => {
    document.body.innerHTML = '<section data-test-id="1"></section>';
    const io = startTracker();
    const [a] = io.observed;
    io.trigger([
      entry(a, {
        ratio: 0.1,
        intersecting: true,
        intersectHeight: 500,
        rootHeight: 900,
      }),
    ]);
    expect(emitted[0].payload.changes).toEqual([{ id: 1, visible: true, ratio: 0.1 }]);
  });

  it('ignores elements the engine has not serialized (id -1)', () => {
    document.body.innerHTML = '<section></section>';
    const io = startTracker();
    io.trigger([entry(io.observed[0], { ratio: 1, intersecting: true })]);
    expect(emitted).toHaveLength(0);
  });

  it('is idempotent: a second start() does not create another observer', () => {
    document.body.innerHTML = '<section data-test-id="1"></section>';
    startTracker();
    tracker!.start();
    expect(FakeIntersectionObserver.instances).toHaveLength(1);
  });

  it('observes elements added after start, once the rescan debounce elapses', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<section data-test-id="1"></section>';
    const io = startTracker();
    expect(io.observed).toHaveLength(1);

    const late = document.createElement('section');
    late.setAttribute('data-test-id', '9');
    document.body.appendChild(late);
    // Let happy-dom's MutationObserver deliver, then run the debounce timer.
    await vi.advanceTimersByTimeAsync(600);
    expect(io.observed.map(el => getNodeId(el))).toContain(9);
    vi.useRealTimers();
  });

  it('emits visible=false for a removed element that was visible', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<section data-test-id="1"></section>';
    const io = startTracker();
    const [a] = io.observed;
    io.trigger([entry(a, { ratio: 1, intersecting: true })]);
    expect(emitted).toHaveLength(1);

    a.remove();
    await vi.advanceTimersByTimeAsync(600);
    expect(emitted).toHaveLength(2);
    expect(emitted[1].payload.changes).toEqual([{ id: 1, visible: false, ratio: 0 }]);
    vi.useRealTimers();
  });

  it('stop() disconnects observers and clears pending rescans', () => {
    document.body.innerHTML = '<section data-test-id="1"></section>';
    const io = startTracker();
    tracker!.stop();
    expect(io.observed).toHaveLength(0);
  });
});
