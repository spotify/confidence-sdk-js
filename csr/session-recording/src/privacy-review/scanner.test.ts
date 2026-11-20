// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { record, type RecordingConfig } from '@spotify-confidence/csr-recorder';
import type { RecordingEvent } from '@spotify-confidence/csr-common';
import { findPotentialPii, suggestMaskingConfig } from './scanner';

// Records with the real recorder, so findings are checked against real event shapes.
async function recorded(html: string, config: RecordingConfig = {}, act?: () => void): Promise<RecordingEvent[]> {
  document.body.innerHTML = html;
  const events: RecordingEvent[] = [];
  const stop = record(event => events.push(event), config);
  act?.();
  await new Promise(resolve => setTimeout(resolve, 0));
  stop();
  return events;
}

describe('findPotentialPii', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('finds personal data in text and attributes, with a selector for each', async () => {
    const findings = findPotentialPii(
      await recorded(
        '<p id="greeting">Mail jane.doe@example.com</p>' +
          '<span class="phone">+44 20 7946 0958</span>' +
          '<a href="/reset?token=abc123secret" title="Card 4111 1111 1111 1111">x</a>',
      ),
    );
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'email', location: 'text', selector: '#greeting' }),
        expect.objectContaining({ kind: 'phone', location: 'text', selector: 'span.phone' }),
        expect.objectContaining({ kind: 'token', location: 'attribute', attribute: 'href', selector: 'a' }),
        expect.objectContaining({ kind: 'card', location: 'attribute', attribute: 'title' }),
      ]),
    );
    expect(JSON.stringify(findings)).not.toContain('jane.doe@example.com');
  });

  it('ignores masked values and numbers that are not personal data', async () => {
    const findings = findPotentialPii(
      await recorded('<p data-csr-mask>jane@example.com</p><p>Order 1234567890123 · 2026-11-20 · 3 items · €12.50</p>'),
    );
    expect(findings).toEqual([]);
  });

  it('rejects card-length numbers that fail the Luhn check', async () => {
    expect(findPotentialPii(await recorded('<p>4111 1111 1111 1112</p>'))).toEqual([]);
  });

  it('finds values added after the first snapshot and typed into inputs', async () => {
    const events = await recorded('<div id="root"></div><input id="email">', { maskInputs: false }, () => {
      document.getElementById('root')!.innerHTML = '<b>later@example.com</b>';
      const input = document.getElementById('email') as HTMLInputElement;
      input.value = 'typed@example.com';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const findings = findPotentialPii(events);
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'email', location: 'text', selector: 'b' }),
        expect.objectContaining({ kind: 'email', location: 'input', selector: '#email' }),
      ]),
    );
  });

  it('reports a repeated value once', async () => {
    const events = await recorded('<p id="a">jane@example.com</p>');
    expect(findPotentialPii([...events, ...events])).toHaveLength(1);
  });
});

describe('suggestMaskingConfig', () => {
  it('suggests specific selectors, attributes and input masking, but never a bare tag', async () => {
    const events = await recorded(
      '<p id="greeting">jane@example.com</p><p>bare@example.com</p><img alt="jane@example.com"><input id="i">',
      { maskInputs: false },
      () => {
        const input = document.getElementById('i') as HTMLInputElement;
        input.value = 'typed@example.com';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
    );
    expect(suggestMaskingConfig(findPotentialPii(events))).toEqual({
      maskSelectors: ['#greeting'],
      maskAttributes: ['alt'],
      maskInputs: true,
    });
  });
});
