import {
  ApplyFlagsRequest,
  ResolveFlagsRequest,
  ResolveFlagsResponse,
} from './generated/confidence/flags/resolver/v1/api';
import { ResolveReason, Sdk, SdkId } from './generated/confidence/flags/resolver/v1/types';
import { base64FromBytes, bytesFromBase64 } from './base64';
import { FlagBundle } from './FlagBundle';
import { Logger } from './logger';

const DEFAULT_URL = 'https://resolver.confidence.dev';
const FLAG_PREFIX = 'flags/';

// TODO: a dedicated SDK id for the thin client would make its resolve traffic
// distinguishable from the rest of the JS SDK. Additive proto change.
const SDK: Sdk = {
  id: SdkId.SDK_ID_JS_CONFIDENCE,
  version: '0.3.20', // x-release-please-version
};

/**
 * Evaluation context, passed through to targeting verbatim.
 *
 * Note the wire spelling `targeting_key` — this is the resolver's contract, not
 * OpenFeature's `targetingKey`.
 * @public
 */
export type EvaluationContext = {
  /** The id of the randomization unit */
  targeting_key?: string;
  /** Any other attribute used for targeting */
  [key: string]: unknown;
};

/**
 * Types belonging to {@link (ConfidenceClient:class)}
 * @public
 */
export namespace ConfidenceClient {
  // Types only, so this is erased and may precede the class it merges with.

  /** Options for constructing a {@link (ConfidenceClient:class)} */
  export interface Options {
    /** Credentials identifying the client and the flags available to it */
    flagClientSecret: string;
    /**
     * Resolver base URL. Also used for the request path when `fetch` is a
     * Cloudflare service binding (bindings route by binding, not by hostname).
     *
     * Defaults to `https://resolver.confidence.dev`.
     */
    url?: string;
    /** fetch-compatible transport. Pass a Cloudflare service binding here. */
    fetch?: typeof fetch;
    /** Optional logger. Nothing is logged when omitted. */
    logger?: Logger;
  }

  /** The outcome of {@link (ConfidenceClient:class).apply} */
  export type ApplyResult =
    | { ok: true }
    | {
        /** The exposure was not recorded */
        ok: false;
        /** `TIMEOUT` when the signal aborted with a `TimeoutError` */
        errorCode: 'TIMEOUT' | 'GENERAL';
        /** Human-readable cause */
        errorMessage: string;
        /** HTTP status, absent for transport failures, timeouts and aborts */
        status?: number;
      };
}

/**
 * A thin, stateless flag client for use against a remote resolver — a
 * Confidence resolver Worker reached via service binding, or
 * `resolver.confidence.dev` over HTTP.
 *
 * There is no lifecycle, no background work and no cached state: constructing
 * one is free, so it can be created per request or shared at module level —
 * it makes no difference.
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class ConfidenceClient {
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly logger?: Logger;

  /** Create a client. Does no work */
  constructor(options: ConfidenceClient.Options) {
    this.clientSecret = options.flagClientSecret;
    // Trailing slashes would produce '//v1/flags:resolve'.
    this.baseUrl = (options.url ?? DEFAULT_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.logger = options.logger;
  }

  /**
   * Resolve the named flags — or all flags available to the client, when the
   * array is empty.
   *
   * `apply` defaults to true, so a resolve counts as an exposure. Pass
   * `{ apply: false }` to defer exposure to an explicit
   * {@link (ConfidenceClient:class).apply} call; the returned bundle then
   * carries a resolve token to apply against.
   *
   * There is no timeout option — pass a `signal` instead, which covers both
   * deadlines and cancellation with one parameter:
   * `resolve(flags, ctx, \{ signal: AbortSignal.timeout(1000) \})`. A signal that
   * aborts with a `TimeoutError` is reported as `errorCode: 'TIMEOUT'`.
   *
   * Never rejects. A transport, HTTP, timeout or decoding failure yields an
   * errored bundle instead: {@link (FlagBundle:namespace).evaluate} then returns
   * defaults with an `ERROR` reason, and because the bundle is still plain JSON
   * the failure travels to the browser correctly labelled. Callers that want to
   * branch can check `errorCode` on the bundle.
   */
  async resolve(
    flagNames: string[],
    context: EvaluationContext,
    options?: { apply?: boolean; signal?: AbortSignal },
  ): Promise<FlagBundle> {
    try {
      const request: ResolveFlagsRequest = {
        flags: flagNames.map(name => FLAG_PREFIX + name),
        evaluationContext: context,
        apply: options?.apply ?? true,
        clientSecret: this.clientSecret,
        sdk: SDK,
      };
      const response = await this.post('/v1/flags:resolve', ResolveFlagsRequest.toJSON(request), options?.signal);
      return createBundle(ResolveFlagsResponse.fromJSON(await response.json()));
    } catch (err) {
      // Named once here; evaluation would otherwise report it per flag.
      this.logger?.warn?.('Resolve failed, returning an errored bundle. %s', String(err));
      return erroredBundle(isTimeout(err) ? 'TIMEOUT' : 'GENERAL', String(err));
    }
  }

  /**
   * Record exposure for flags from an earlier `resolve(..., \{ apply: false \})`.
   *
   * Flags whose {@link (FlagBundle:namespace).Details.shouldApply | shouldApply}
   * is false can be skipped to save a request — applying them has no observable
   * effect.
   *
   * A token only permits applying the flags it was minted for; naming any other
   * flag fails the call in full.
   *
   * Never rejects — failures come back as
   * {@link (ConfidenceClient:namespace).ApplyResult} and are logged. Pass
   * `\{ signal: AbortSignal.timeout(1000) \}` to bound it.
   */
  async apply(
    resolveToken: string,
    flagNames: string | string[],
    options?: { signal?: AbortSignal },
  ): Promise<ConfidenceClient.ApplyResult> {
    const names = typeof flagNames === 'string' ? [flagNames] : flagNames;
    // A resolve with apply=true returns no token, and there is nothing to
    // apply for an empty flag list — save the round trip either way.
    if (!resolveToken || names.length === 0) return { ok: true };

    try {
      const now = new Date();
      const request: ApplyFlagsRequest = {
        flags: names.map(name => ({ flag: FLAG_PREFIX + name, applyTime: now })),
        clientSecret: this.clientSecret,
        // Throws on malformed base64 in browsers; caught below with everything else.
        resolveToken: bytesFromBase64(resolveToken),
        sendTime: now,
        sdk: SDK,
      };
      await this.post('/v1/flags:apply', ApplyFlagsRequest.toJSON(request), options?.signal);
      return { ok: true };
    } catch (err) {
      this.logger?.warn?.('Apply failed, exposure was not recorded. %s', String(err));
      return {
        ok: false,
        errorCode: isTimeout(err) ? 'TIMEOUT' : 'GENERAL',
        errorMessage: String(err),
        status: err instanceof HttpError ? err.status : undefined,
      };
    }
  }

  private async post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      // The resolver returns diagnostics as the body (e.g. "client secret not
      // found: requested=..., available=[...]") — worth surfacing.
      const detail = await response.text().catch(() => '');
      throw new HttpError(
        response.status,
        `Confidence ${path} failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`,
      );
    }
    return response;
  }
}

/**
 * Carries the status through to {@link (ConfidenceClient:namespace).ApplyResult},
 * so callers can tell 4xx from 5xx.
 */
class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * True for a signal that aborted on a deadline, as `AbortSignal.timeout()`
 * produces. Some runtimes nest the reason under `cause` instead of surfacing it
 * directly, so both are checked. A deliberate `controller.abort()` is an
 * `AbortError` and deliberately not reported as a timeout.
 */
function isTimeout(err: unknown): boolean {
  const { name, cause } = (err ?? {}) as { name?: unknown; cause?: { name?: unknown } };
  return name === 'TimeoutError' || cause?.name === 'TimeoutError';
}

function createBundle({ resolveId, resolveToken, resolvedFlags }: ResolveFlagsResponse): FlagBundle {
  const flags: FlagBundle['flags'] = {};
  for (const { flag, reason, variant, value, shouldApply, assignmentOrigin } of resolvedFlags) {
    flags[flag.slice(FLAG_PREFIX.length)] = {
      reason: convertReason(reason),
      variant,
      value: (value ?? null) as FlagBundle.Struct | null,
      shouldApply,
      assignmentOrigin,
    };
  }

  return { flags, resolveId, resolveToken: base64FromBytes(resolveToken) };
}

function erroredBundle(errorCode: FlagBundle.ErrorCode, errorMessage: string): FlagBundle {
  return { flags: {}, resolveId: '', resolveToken: '', errorCode, errorMessage };
}

function convertReason(reason: ResolveReason): FlagBundle.Reason {
  switch (reason) {
    case ResolveReason.RESOLVE_REASON_ERROR:
      return 'ERROR';
    case ResolveReason.RESOLVE_REASON_FLAG_ARCHIVED:
      return 'FLAG_ARCHIVED';
    case ResolveReason.RESOLVE_REASON_MATCH:
      return 'MATCH';
    case ResolveReason.RESOLVE_REASON_NO_SEGMENT_MATCH:
      return 'NO_SEGMENT_MATCH';
    case ResolveReason.RESOLVE_REASON_TARGETING_KEY_ERROR:
      return 'TARGETING_KEY_ERROR';
    case ResolveReason.RESOLVE_REASON_NO_TREATMENT_MATCH:
      return 'NO_TREATMENT_MATCH';
    default:
      return 'UNSPECIFIED';
  }
}
