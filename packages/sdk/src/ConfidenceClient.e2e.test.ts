import { ConfidenceClient } from './ConfidenceClient';
import { FlagBundle } from './FlagBundle';

/**
 * End-to-end tests for the thin client against the real online resolver at
 * `resolver.confidence.dev` (the client's default url, deliberately left unset
 * below so the default is covered too).
 *
 * These cover what the mocked-transport unit tests structurally cannot: that
 * the canonical protobuf JSON the client emits is what a real resolver accepts,
 * that the JSON it sends back decodes into a `FlagBundle`, and that the
 * `resolve(..., { apply: false })` -> `resolveToken` -> `apply()` round trip
 * actually works against a server rather than against our own assumptions.
 *
 * They use the same `web-sdk-e2e-flag` and context as `Confidence.e2e.test.ts`,
 * so the two are directly comparable.
 *
 * Note that the applies below record real exposures for `web-sdk-e2e-flag`.
 */

const FLAG = 'web-sdk-e2e-flag';
// A second flag on the same client, used to check that a resolve token only
// permits applying the flags it was minted for.
const OTHER_FLAG = 'custom-targeted-flag';

// Context is passed through to targeting verbatim, so the wire spelling
// `targeting_key` is what's used here — not OpenFeature's `targetingKey`.
// `sticky: false` keeps us off the flag's sticky experiment, so the control
// variant is deterministic.
const CONTEXT = { targeting_key: 'test-a', sticky: false };

const VARIANT = `flags/${FLAG}/variants/control`;
const ASSIGNMENT_ORIGIN = `flags/${FLAG}/rules/zphggscnfdpvcp4jy5ui`;
const CONTROL_VALUE = {
  str: 'control',
  bool: false,
  double: 3.5,
  int: 3,
  obj: { str: 'obj control', bool: false, double: 3.6, int: 4, ['obj-obj']: {} },
};

// Every test here makes at least one network round trip.
const TIMEOUT = 20_000;

const client = new ConfidenceClient({ flagClientSecret: process.env.CONFIDENCE_CLIENT_SECRET! });

describe('ConfidenceClient E2E (resolve)', () => {
  it(
    'resolves a flag into a bundle keyed by unprefixed flag name',
    async () => {
      const bundle = await client.resolve([FLAG], CONTEXT, { apply: false });

      expect(bundle.resolveId).toBeTruthy();
      expect(bundle.flags[FLAG]).toEqual({
        reason: 'MATCH',
        variant: VARIANT,
        value: CONTROL_VALUE,
        shouldApply: true,
        assignmentOrigin: ASSIGNMENT_ORIGIN,
      });
    },
    TIMEOUT,
  );

  it(
    'returns a resolve token when apply is deferred',
    async () => {
      const { resolveToken } = await client.resolve([FLAG], CONTEXT, { apply: false });

      // Base64 of the encrypted token — opaque here, but it has to survive a
      // JSON hop to the browser and come back applyable.
      expect(resolveToken).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    },
    TIMEOUT,
  );

  it(
    'returns no resolve token when the resolve itself applied',
    async () => {
      // apply defaults to true, and a resolve that already counted as an
      // exposure has nothing left to apply — hence the empty token that
      // `apply()` short-circuits on.
      const { resolveToken } = await client.resolve([FLAG], CONTEXT);

      expect(resolveToken).toBe('');
    },
    TIMEOUT,
  );

  it(
    'resolves every flag available to the client for an empty flag list',
    async () => {
      const bundle = await client.resolve([], CONTEXT, { apply: false });

      expect(Object.keys(bundle.flags).length).toBeGreaterThan(1);
      expect(bundle.flags[FLAG]).toMatchObject({ reason: 'MATCH', variant: VARIANT });
    },
    TIMEOUT,
  );

  it(
    'returns an errored bundle carrying the resolver diagnostic for an unknown client secret',
    async () => {
      const bogus = new ConfidenceClient({ flagClientSecret: 'not-a-real-client-secret' });

      const bundle = await bogus.resolve([FLAG], CONTEXT, { apply: false });

      // Status not pinned to 4xx — the Cloudflare edge resolver answers 500 for
      // an unknown secret. What matters is that the diagnostic survives.
      expect(bundle.errorCode).toBe('GENERAL');
      expect(bundle.errorMessage).toMatch(/flags:resolve failed: \d{3}/);
      expect(FlagBundle.evaluate(bundle, FLAG, 'fallback')).toMatchObject({ reason: 'ERROR', value: 'fallback' });
    },
    TIMEOUT,
  );

  it(
    'labels a real deadline miss as TIMEOUT',
    async () => {
      // The client has no timeout option, so `AbortSignal.timeout` is the whole
      // mechanism — and whether a runtime propagates `TimeoutError` through
      // `fetch` is exactly the kind of assumption a unit test cannot check.
      // 1ms is unreachable over the network.
      const bundle = await client.resolve([FLAG], CONTEXT, { apply: false, signal: AbortSignal.timeout(1) });

      expect(bundle.errorCode).toBe('TIMEOUT');
      expect(FlagBundle.evaluate(bundle, FLAG, 'fallback')).toMatchObject({
        reason: 'ERROR',
        errorCode: 'TIMEOUT',
        value: 'fallback',
      });
    },
    TIMEOUT,
  );

  it(
    'returns an errored bundle for a deliberate abort, without labelling it a timeout',
    async () => {
      const controller = new AbortController();
      controller.abort();

      const bundle = await client.resolve([FLAG], CONTEXT, { apply: false, signal: controller.signal });

      expect(bundle.errorCode).toBe('GENERAL');
    },
    TIMEOUT,
  );
});

describe('ConfidenceClient E2E (evaluate a forwarded bundle)', () => {
  // The bundle a browser would see: resolved server-side, serialized into the
  // page, parsed back out. `FlagBundle.evaluate` is pure, so this is the whole
  // transport.
  let forwarded: FlagBundle;

  beforeAll(async () => {
    const bundle = await client.resolve([FLAG], CONTEXT, { apply: false });
    forwarded = JSON.parse(JSON.stringify(bundle));
  }, TIMEOUT);

  it('survives the JSON round trip intact', () => {
    expect(forwarded.flags[FLAG]?.value).toEqual(CONTROL_VALUE);
    expect(forwarded.resolveToken).toBeTruthy();
  });

  it('evaluates the whole flag against an object default', () => {
    const details = FlagBundle.evaluate(forwarded, FLAG, { str: 'default', int: 0 });

    expect(details.value).toEqual(CONTROL_VALUE);
    expect(details.reason).toBe('MATCH');
    expect(details.variant).toBe(VARIANT);
    expect(details.shouldApply).toBe(true);
  });

  it('evaluates dot paths into the flag value', () => {
    expect(FlagBundle.evaluate(forwarded, `${FLAG}.bool`, true).value).toBe(false);
    expect(FlagBundle.evaluate(forwarded, `${FLAG}.int`, 10).value).toBe(3);
    expect(FlagBundle.evaluate(forwarded, `${FLAG}.double`, 10).value).toBe(3.5);
    expect(FlagBundle.evaluate(forwarded, `${FLAG}.str`, 'default').value).toBe('control');
    expect(FlagBundle.evaluate(forwarded, `${FLAG}.obj`, {}).value).toEqual(CONTROL_VALUE.obj);
    expect(FlagBundle.evaluate(forwarded, `${FLAG}.obj.double`, 1).value).toBe(3.6);
  });

  it('returns the default with an ERROR reason on a type mismatch', () => {
    const details = FlagBundle.evaluate(forwarded, `${FLAG}.str`, 42);

    expect(details.value).toBe(42);
    expect(details.reason).toBe('ERROR');
    expect(details.errorCode).toBe('TYPE_MISMATCH');
  });

  it('returns the default with FLAG_NOT_FOUND for a flag outside the bundle', () => {
    const details = FlagBundle.evaluate(forwarded, 'no-such-flag', 'fallback');

    expect(details.value).toBe('fallback');
    expect(details.reason).toBe('ERROR');
    expect(details.errorCode).toBe('FLAG_NOT_FOUND');
  });
});

describe('ConfidenceClient E2E (apply)', () => {
  let resolveToken: string;

  beforeAll(async () => {
    const bundle = await client.resolve([FLAG], CONTEXT, { apply: false });

    // Asserted here on purpose. `resolve` never rejects, so a transient failure
    // would yield an errored bundle with an empty token; `apply` then
    // short-circuits to `{ ok: true }` without a request, which passes the
    // positive tests below vacuously and fails the negative ones with a
    // baffling "expected ok: false, received ok: true". Failing in the hook
    // instead points at the real cause and prints the resolver's diagnostic.
    expect(bundle.errorMessage).toBeUndefined();
    expect(bundle.resolveToken).toBeTruthy();

    ({ resolveToken } = bundle);
  }, TIMEOUT);

  it(
    'records exposure for a single flag name',
    async () => {
      await expect(client.apply(resolveToken, FLAG)).resolves.toEqual({ ok: true });
    },
    TIMEOUT,
  );

  it(
    'records exposure for an array of flag names',
    async () => {
      await expect(client.apply(resolveToken, [FLAG])).resolves.toEqual({ ok: true });
    },
    TIMEOUT,
  );

  it(
    'reports a resolve token the resolver will not accept, carrying the HTTP status',
    async () => {
      const result = await client.apply('bm90LWEtdG9rZW4=', FLAG);

      expect(result).toMatchObject({ ok: false, errorCode: 'GENERAL' });
      // Deliberately not pinned to 4xx. The status is there so a caller can log
      // or branch on it, but it is not a portable retry signal: this resolver
      // answers 4xx, while the Cloudflare edge resolver returns 500 for the
      // same permanently-doomed apply (confidence-cloudflare-resolver
      // src/lib.rs maps every apply error to 500).
      expect(result.ok === false && result.status).toBeGreaterThanOrEqual(400);
      expect(result.ok === false && result.errorMessage).toMatch(/flags:apply failed: \d{3}/);
    },
    TIMEOUT,
  );

  it(
    'fails for a flag the resolve token does not cover',
    async () => {
      // The token above was minted for FLAG alone. A token only permits applying
      // the assignments it actually carries — which is what makes it safe to
      // round-trip through the browser.
      const result = await client.apply(resolveToken, OTHER_FLAG);

      // The diagnostic is the portable part; the status is not (see above).
      expect(result).toMatchObject({ ok: false, errorCode: 'GENERAL' });
      expect(result.ok === false && result.status).toBeGreaterThanOrEqual(400);
      expect(result.ok === false && result.errorMessage).toMatch(
        /Flag in resolve token does not match flag in request/,
      );
    },
    TIMEOUT,
  );

  it(
    'fails the whole batch when one flag is not covered by the token',
    async () => {
      // Failure covers the whole call, including the flag the token does
      // carry — an apply naming a flag it never resolved isn't partly right.
      const result = await client.apply(resolveToken, [FLAG, OTHER_FLAG]);

      expect(result).toMatchObject({ ok: false, errorCode: 'GENERAL' });
      expect(result.ok === false && result.status).toBeGreaterThanOrEqual(400);
      expect(result.ok === false && result.errorMessage).toMatch(
        /Flag in resolve token does not match flag in request/,
      );
    },
    TIMEOUT,
  );

  it(
    'reports a timed-out apply as TIMEOUT',
    async () => {
      const result = await client.apply(resolveToken, FLAG, { signal: AbortSignal.timeout(1) });

      // No status: nothing came back, so a caller could reasonably retry this one.
      expect(result).toEqual({
        ok: false,
        errorCode: 'TIMEOUT',
        errorMessage: expect.any(String),
        status: undefined,
      });
    },
    TIMEOUT,
  );
});
