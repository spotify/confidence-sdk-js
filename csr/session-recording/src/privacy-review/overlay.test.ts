// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElementPrivacyClassifier } from '@spotify-confidence/csr-recorder';
import { collectBoxes, startMaskingOverlay } from './overlay';

const rect = (top: number) => ({ left: 10, top, width: 100, height: 20 } as DOMRect);

// jsdom has no layout, so give every element an on-screen box.
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect(10));
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const states = () =>
  collectBoxes(document, createElementPrivacyClassifier({ maskAllText: true })).map(box => box.state);

describe('collectBoxes', () => {
  it('classifies text, form values and blocked elements, without entering blocked subtrees', () => {
    document.body.innerHTML =
      '<p>masked</p><p data-csr-unmask>shown</p><input><input type="submit" value="Pay">' +
      '<div data-csr-block><p>inside</p></div>' +
      '<div data-confidence-privacy-review-controls><p>panel</p></div><script>x</script>';
    expect(states()).toEqual(['masked', 'visible', 'masked', 'masked', 'blocked']);
  });

  it('walks into open shadow roots and same-origin iframes', () => {
    document.body.innerHTML = '<div id="host" data-csr-unmask></div><iframe></iframe>';
    document.querySelector('#host')!.attachShadow({ mode: 'open' }).innerHTML = '<span>shadow</span>';
    const frame = document.querySelector('iframe')!;
    frame.contentDocument!.body.innerHTML = '<p>frame</p>';
    // The frame has its own Element prototype.
    const frameElement = (frame.contentWindow as unknown as { Element: typeof Element }).Element;
    vi.spyOn(frameElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(10));
    expect(states()).toEqual(['visible', 'masked']);
  });

  it('skips elements that are off screen', () => {
    vi.mocked(Element.prototype.getBoundingClientRect).mockReturnValue(rect(5000));
    document.body.innerHTML = '<p>below the fold</p>';
    expect(states()).toEqual([]);
  });
});

describe('startMaskingOverlay', () => {
  it('draws a box per element, reports counts, and removes them on stop', () => {
    document.body.innerHTML = '<p>a</p><p data-csr-unmask>b</p>';
    const layer = document.createElement('div');
    const onCounts = vi.fn();
    const overlay = startMaskingOverlay(layer, createElementPrivacyClassifier({ maskAllText: true }), onCounts);
    expect(layer.querySelectorAll('.box.masked')).toHaveLength(1);
    expect(layer.querySelectorAll('.box.visible')).toHaveLength(1);
    expect(onCounts).toHaveBeenCalledWith({ visible: 1, masked: 1, blocked: 0 });
    overlay.stop();
    expect(layer.children).toHaveLength(0);
  });
});
