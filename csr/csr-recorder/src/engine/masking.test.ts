// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { createElementPrivacyClassifier } from './masking';

function element(html: string, selector: string): Element {
  document.body.innerHTML = html;
  return document.querySelector(selector)!;
}

describe('createElementPrivacyClassifier', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('applies the recorder defaults: data-csr-mask masks, inputs masked, data-csr-block and video blocked', () => {
    const classifier = createElementPrivacyClassifier({});
    expect(classifier.isTextMasked(element('<p data-csr-mask><b>x</b></p>', 'b'))).toBe(true);
    expect(classifier.isTextMasked(element('<p>x</p>', 'p'))).toBe(false);
    expect(classifier.isInputMasked(element('<input>', 'input'))).toBe(true);
    expect(classifier.isBlocked(element('<video></video>', 'video'))).toBe(true);
    expect(classifier.isBlocked(element('<div data-csr-block></div>', 'div'))).toBe(true);
  });

  it('under maskAllText, the nearer of mask and unmask wins', () => {
    const classifier = createElementPrivacyClassifier({ maskAllText: true, maskSelectors: ['.pii'] });
    expect(classifier.isTextMasked(element('<p>x</p>', 'p'))).toBe(true);
    expect(classifier.isTextMasked(element('<div data-csr-unmask><p>x</p></div>', 'p'))).toBe(false);
    expect(classifier.isTextMasked(element('<div data-csr-unmask><p class="pii">x</p></div>', 'p'))).toBe(true);
    expect(classifier.isTextMasked(element('<div class="pii"><p data-csr-unmask>x</p></div>', 'p'))).toBe(false);
  });

  it('still masks password fields when input masking is off, and fails closed on invalid selectors', () => {
    const classifier = createElementPrivacyClassifier({ maskInputs: false, blockSelectors: [':::'] });
    expect(classifier.isInputMasked(element('<input type="password">', 'input'))).toBe(true);
    expect(classifier.isInputMasked(element('<input type="email">', 'input'))).toBe(false);
    expect(classifier.isBlocked(element('<p>x</p>', 'p'))).toBe(true);
  });
});
