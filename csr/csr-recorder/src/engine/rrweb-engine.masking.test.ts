// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import type { RecordingEvent } from '@spotify-confidence/csr-common';
import { RrwebEngine } from './rrweb-engine';
import type { RecordingConfig } from '../types';

// Uses the real rrweb so these assertions cover what is actually serialized.
async function recordedText(
  config: RecordingConfig,
  page: string | (() => void),
  mutate?: () => void,
): Promise<string> {
  if (typeof page === 'string') document.body.innerHTML = page;
  else page();
  const events: RecordingEvent[] = [];
  const engine = new RrwebEngine();
  engine.start(config, event => events.push(event));
  mutate?.();
  // rrweb emits mutations asynchronously.
  await new Promise(resolve => setTimeout(resolve, 0));
  engine.stop();
  return JSON.stringify(events);
}

describe('maskAllText', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('masks text outside data-csr-unmask and keeps text inside it', async () => {
    const wire = await recordedText(
      { maskAllText: true },
      '<p>jane@example.com</p><nav data-csr-unmask><a>Checkout</a></nav>',
    );
    expect(wire).not.toContain('jane@example.com');
    expect(wire).toContain('****************');
    expect(wire).toContain('Checkout');
  });

  it('lets maskSelectors override data-csr-unmask', async () => {
    const wire = await recordedText(
      { maskAllText: true, maskSelectors: ['.pii'] },
      '<section data-csr-unmask><h1>Account</h1><span class="pii">Jane Doe</span></section>',
    );
    expect(wire).toContain('Account');
    expect(wire).not.toContain('Jane Doe');
  });

  it('masks text added after the initial snapshot', async () => {
    const wire = await recordedText({ maskAllText: true }, '<div id="root"></div>', () => {
      document.getElementById('root')!.textContent = 'secret-order-123';
    });
    expect(wire).not.toContain('secret-order-123');
    expect(wire).toContain('*'.repeat('secret-order-123'.length));
  });

  it('masks everything when a maskSelector is invalid', async () => {
    const wire = await recordedText(
      { maskAllText: true, maskSelectors: ['[[invalid'] },
      '<p data-csr-unmask>Visible title</p>',
    );
    expect(wire).not.toContain('Visible title');
  });

  it('leaves text unmasked when maskAllText is off', async () => {
    expect(await recordedText({}, '<p>Plain copy</p>')).toContain('Plain copy');
  });

  it('lets the nearer of mask and unmask win, in both directions', async () => {
    const wire = await recordedText(
      { maskAllText: true, maskSelectors: ['.pii'] },
      '<section class="pii"><h2 data-csr-unmask>Order summary</h2><p>Jane Doe</p></section>',
    );
    expect(wire).toContain('Order summary');
    expect(wire).not.toContain('Jane Doe');
  });

  it('keeps data-csr-mask working alongside custom maskSelectors', async () => {
    const wire = await recordedText(
      { maskAllText: true, maskSelectors: ['.pii'] },
      '<section data-csr-unmask><h1>Orders</h1><span data-csr-mask>Jane Doe</span></section>',
    );
    expect(wire).toContain('Orders');
    expect(wire).not.toContain('Jane Doe');
  });

  it('masks the default attributes and button values, and leaves other attributes', async () => {
    const wire = await recordedText(
      { maskAllText: true },
      '<img alt="jane-alt"><button title="jane-title" aria-label="jane-label">x</button>' +
        '<input placeholder="jane-placeholder"><input type="submit" value="Pay as jane-submit">' +
        '<a href="/help" class="link">?</a><span data-csr-unmask title="Help centre">?</span>',
    );
    for (const leaked of ['jane-alt', 'jane-title', 'jane-label', 'jane-placeholder', 'jane-submit']) {
      expect(wire).not.toContain(leaked);
    }
    expect(wire).toContain('/help');
    expect(wire).toContain('"class":"link"');
    expect(wire).toContain('Help centre');
  });

  it('masks attributes set after the initial snapshot', async () => {
    const wire = await recordedText({ maskAllText: true }, '<button id="b">x</button>', () => {
      document.getElementById('b')!.setAttribute('title', 'jane@example.com');
      document.body.insertAdjacentHTML('beforeend', '<img alt="Jane Doe">');
    });
    expect(wire).not.toContain('jane@example.com');
    expect(wire).not.toContain('Jane Doe');
    expect(wire).toContain('*'.repeat('jane@example.com'.length));
  });

  it('leaves text input values to maskInputs', async () => {
    const wire = await recordedText(
      { maskAllText: true, maskInputs: false },
      '<input type="email" value="typed@example.com">',
    );
    expect(wire).toContain('typed@example.com');
  });

  function shadowHost(hostAttributes: string, shadowHtml: string, doc: Document = document): void {
    doc.body.innerHTML = `<div id="host" ${hostAttributes}></div>`;
    doc.getElementById('host')!.attachShadow({ mode: 'open' }).innerHTML = shadowHtml;
  }

  it('applies data-csr-unmask on a shadow host to its shadow content', async () => {
    const wire = await recordedText({ maskAllText: true }, () => shadowHost('data-csr-unmask', '<p>Shadow title</p>'));
    expect(wire).toContain('Shadow title');
  });

  it('lets a mask inside a shadow root win over data-csr-unmask on its host', async () => {
    const wire = await recordedText({ maskAllText: true, maskSelectors: ['.pii'] }, () =>
      shadowHost('data-csr-unmask', '<h3>Profile</h3><span class="pii" title="Jane title">Jane Doe</span>'),
    );
    expect(wire).toContain('Profile');
    expect(wire).not.toContain('Jane Doe');
    expect(wire).not.toContain('Jane title');
  });

  it('crosses shadow boundaries inside same-origin iframes', async () => {
    const wire = await recordedText({ maskAllText: true, maskSelectors: ['.pii'] }, () => {
      const frame = document.createElement('iframe');
      document.body.appendChild(frame);
      shadowHost('data-csr-unmask', '<h3>Profile</h3><span class="pii">Jane Doe</span>', frame.contentDocument!);
    });
    expect(wire).toContain('Profile');
    expect(wire).not.toContain('Jane Doe');
  });
});

describe('maskAttributes', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('masks attributes only where text is masked when maskAllText is off', async () => {
    const wire = await recordedText(
      { maskSelectors: ['.pii'] },
      '<p title="Public tooltip">Plain copy</p><span class="pii" title="jane-title"><img alt="jane-alt"></span>',
    );
    expect(wire).toContain('Plain copy');
    expect(wire).toContain('Public tooltip');
    expect(wire).not.toContain('jane-title');
    expect(wire).not.toContain('jane-alt');
  });

  it('leaves attributes alone with the default config outside data-csr-mask', async () => {
    const wire = await recordedText({}, '<img alt="Team photo" title="Team tooltip">');
    expect(wire).toContain('Team photo');
    expect(wire).toContain('Team tooltip');
  });

  it('masks listed attributes on every element and keeps the defaults where text is masked', async () => {
    const wire = await recordedText(
      { maskAttributes: ['href', 'data-user'] },
      '<a href="mailto:jane@example.com" data-user="jane-user" title="Help">e</a>' +
        '<p data-csr-mask title="jane-title">x</p>',
    );
    expect(wire).not.toContain('jane@example.com');
    expect(wire).not.toContain('jane-user');
    expect(wire).toContain('Help');
    expect(wire).not.toContain('jane-title');
  });

  it('keeps listed attributes under a nearer data-csr-unmask', async () => {
    const wire = await recordedText({ maskAttributes: ['href'] }, '<nav data-csr-unmask><a href="/orders">o</a></nav>');
    expect(wire).toContain('/orders');
  });
});
