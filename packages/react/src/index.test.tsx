import React, { act, StrictMode } from 'react';
import { createRoot, hydrateRoot, Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { FlagBundle } from '@spotify-confidence/sdk';
import { ConfidenceProvider, FlagDetails, useFlag, useFlagDetails } from './index';

function bundle(overrides: Partial<FlagBundle> = {}): FlagBundle {
  return {
    flags: {
      checkout: { reason: 'MATCH', value: { enabled: true }, variant: 'flags/checkout/variants/on', shouldApply: true },
    },
    resolveId: 'resolve-1',
    resolveToken: 'opaque-token',
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;
let details: FlagDetails<boolean>;
function Flag({ manual = false, flagKey = 'checkout.enabled' }: { manual?: boolean; flagKey?: string }) {
  details = useFlagDetails(flagKey, false, { expose: !manual });
  return <span>{String(details.value)}</span>;
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  delete window.__confidence;
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test('evaluates nested flags and deduplicates exposure across consumers and StrictMode effects', async () => {
  const apply = jest.fn();
  await act(async () =>
    root.render(
      <StrictMode>
        <ConfidenceProvider bundle={bundle()} apply={apply}>
          <Flag />
          <Flag />
        </ConfidenceProvider>
      </StrictMode>,
    ),
  );
  expect(container.textContent).toBe('truetrue');
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledWith('checkout');
  expect(window.__confidence?.flags?.['flags/checkout'].variant).toBe('flags/checkout/variants/on');
});

test('manual exposure waits for use, deduplicates in-flight calls, and resolves on delivery', async () => {
  let finish!: () => void;
  const apply = jest.fn(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      }),
  );
  await act(async () =>
    root.render(
      <ConfidenceProvider bundle={bundle()} apply={apply}>
        <Flag manual />
      </ConfidenceProvider>,
    ),
  );
  expect(apply).not.toHaveBeenCalled();
  const first = details.expose();
  expect(details.expose()).toBe(first);
  await Promise.resolve();
  finish();
  await first;
  await details.expose();
  expect(apply).toHaveBeenCalledTimes(1);
});

test('new bundle resets exposure; a changed callback alone does not', async () => {
  const first = bundle();
  const apply = jest.fn();
  await act(async () =>
    root.render(
      <ConfidenceProvider bundle={first} apply={apply}>
        <Flag />
      </ConfidenceProvider>,
    ),
  );
  const nextApply = jest.fn();
  await act(async () =>
    root.render(
      <ConfidenceProvider bundle={first} apply={nextApply}>
        <Flag />
      </ConfidenceProvider>,
    ),
  );
  expect(nextApply).not.toHaveBeenCalled();
  await act(async () =>
    root.render(
      <ConfidenceProvider bundle={bundle({ resolveId: 'resolve-2' })} apply={nextApply}>
        <Flag />
      </ConfidenceProvider>,
    ),
  );
  expect(nextApply).toHaveBeenCalledTimes(1);
});

test.each(['throw', 'result'])('failed manual exposure (%s) rejects and can be retried', async mode => {
  const apply = jest
    .fn()
    .mockImplementationOnce(() => {
      if (mode === 'throw') throw new Error('offline');
      return { ok: false, errorMessage: 'offline' };
    })
    .mockResolvedValue({ ok: true });
  await act(async () =>
    root.render(
      <ConfidenceProvider bundle={bundle()} apply={apply}>
        <Flag manual />
      </ConfidenceProvider>,
    ),
  );
  await expect(details.expose()).rejects.toThrow('offline');
  await details.expose();
  expect(apply).toHaveBeenCalledTimes(2);
});

test('automatic exposure failures reach the error handler without an unhandled rejection', async () => {
  const onExposureError = jest.fn();
  await act(async () =>
    root.render(
      <ConfidenceProvider bundle={bundle()} apply={() => Promise.reject('offline')} onExposureError={onExposureError}>
        <Flag />
      </ConfidenceProvider>,
    ),
  );
  expect(onExposureError).toHaveBeenCalledWith(new Error('offline'));
});

test('missing provider and flags return defaults without exposure', async () => {
  await act(async () => root.render(<Flag />));
  expect(details.errorCode).toBe('GENERAL');
  expect(details.value).toBe(false);
  await details.expose();
  const apply = jest.fn();
  await act(async () =>
    root.render(
      <ConfidenceProvider bundle={bundle()} apply={apply}>
        <Flag flagKey="missing.enabled" />
      </ConfidenceProvider>,
    ),
  );
  expect(details.errorCode).toBe('FLAG_NOT_FOUND');
  expect(apply).not.toHaveBeenCalled();
});

test.each(['NO_SEGMENT_MATCH', 'MATERIALIZATION_NOT_SUPPORTED', 'ERROR'] as const)(
  'non-match %s does not expose',
  async reason => {
    const apply = jest.fn();
    const snapshot = bundle({ flags: { checkout: { reason, value: null, shouldApply: false } } });
    await act(async () =>
      root.render(
        <ConfidenceProvider bundle={snapshot} apply={apply}>
          <Flag />
        </ConfidenceProvider>,
      ),
    );
    expect(details.value).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(details.errorCode).toBe(reason === 'NO_SEGMENT_MATCH' ? undefined : 'GENERAL');
  },
);

test.each(['TIMEOUT', 'PROVIDER_NOT_READY', 'PROVIDER_FATAL'] as const)(
  'bundle error %s survives serialization',
  async errorCode => {
    const snapshot: FlagBundle = JSON.parse(
      JSON.stringify(bundle({ flags: {}, errorCode, errorMessage: 'unavailable' })),
    );
    const apply = jest.fn();
    await act(async () =>
      root.render(
        <ConfidenceProvider bundle={snapshot} apply={apply}>
          <Flag />
        </ConfidenceProvider>,
      ),
    );
    expect(details.value).toBe(false);
    expect(details.errorCode).toBe(errorCode);
    expect(details.errorMessage).toBe('unavailable');
    expect(apply).not.toHaveBeenCalled();
  },
);

test('type errors do not expose or publish a variant', async () => {
  const apply = jest.fn();
  await act(async () =>
    root.render(
      <ConfidenceProvider bundle={bundle()} apply={apply}>
        <Flag flagKey="checkout" />
      </ConfidenceProvider>,
    ),
  );
  expect(details.errorCode).toBe('TYPE_MISMATCH');
  expect(apply).not.toHaveBeenCalled();
  expect(window.__confidence).toBeUndefined();
});

test('already-applied bundles publish the evaluated variant without sending exposure', async () => {
  const snapshot = bundle();
  snapshot.flags.checkout!.shouldApply = false;
  const apply = jest.fn();
  await act(async () =>
    root.render(
      <ConfidenceProvider bundle={snapshot} apply={apply}>
        <Flag />
      </ConfidenceProvider>,
    ),
  );
  expect(apply).not.toHaveBeenCalled();
  expect(window.__confidence?.flags?.['flags/checkout']).toBeDefined();
});

test('JSON-forwarded bundle renders on the server without exposure and hydrates consistently', async () => {
  const snapshot: FlagBundle = JSON.parse(JSON.stringify(bundle({ resolveToken: '' })));
  const apply = jest.fn();
  function Value() {
    return <span>{String(useFlag('checkout.enabled', false))}</span>;
  }
  const element = (
    <ConfidenceProvider bundle={snapshot} apply={apply}>
      <Value />
    </ConfidenceProvider>
  );
  const html = renderToString(element);
  expect(html).toBe('<span>true</span>');
  expect(apply).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  container.innerHTML = html;
  const onRecoverableError = jest.fn();
  await act(async () => {
    root = hydrateRoot(container, element, { onRecoverableError });
  });
  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(container.textContent).toBe('true');
  expect(apply).toHaveBeenCalledTimes(1);
});
