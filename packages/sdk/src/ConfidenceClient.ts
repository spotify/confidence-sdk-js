import {
  ApplyFlagsRequest,
  ResolveFlagsRequest,
  ResolveFlagsResponse,
} from './generated/confidence/flags/resolver/v1/api';
import { ResolveReason, Sdk, SdkId } from './generated/confidence/flags/resolver/v1/types';
import { base64FromBytes, bytesFromBase64 } from './base64';
import { FlagBundle } from './FlagBundle';
import { Logger } from './logger';

const FLAG_PREFIX = 'flags/';
const EVENT_PREFIX = 'eventDefinitions/';

/**
 * Base URL of a Confidence service, in the given region or the global one.
 *
 * Flags and events are separate services, so a single URL option could never
 * place both — which is why `region` is the option and a URL is not. Rewriting
 * URLs outright is still possible through `fetch`, and stays the rare case it is.
 */
function serviceUrl(service: 'resolver' | 'events', region?: ConfidenceClient.Region): string {
  return `https://${service}${region ? `.${region}` : ''}.confidence.dev`;
}

/**
 * Browsers share one 64KB quota across all in-flight `keepalive` bodies and fail
 * the fetch outright when it is exceeded, so only bodies comfortably under it
 * are sent that way. The quota is measured in encoded bytes.
 */
const KEEPALIVE_MAX_BODY_BYTES = 50_000;

const DEFAULT_VERSION = '0.5.0'; // x-release-please-version

// TODO: a dedicated SDK id for the thin client would make its own resolve
// traffic distinguishable from the rest of the JS SDK, the way the provider ids
// below distinguish theirs. Additive proto change.
const SDK_IDS: Record<ConfidenceClient.SdkName, SdkId> = {
  JS_CONFIDENCE: SdkId.SDK_ID_JS_CONFIDENCE,
  JS_WEB_PROVIDER: SdkId.SDK_ID_JS_WEB_PROVIDER,
  JS_SERVER_PROVIDER: SdkId.SDK_ID_JS_SERVER_PROVIDER,
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

  /**
   * Names the calling SDK to the resolver. `JS_CONFIDENCE` is this SDK itself;
   * the others belong to the OpenFeature providers built on this client.
   */
  export type SdkName = 'JS_CONFIDENCE' | 'JS_WEB_PROVIDER' | 'JS_SERVER_PROVIDER';

  /** A Confidence data region */
  export type Region = 'eu' | 'us';

  /** Options for constructing a {@link (ConfidenceClient:class)} */
  export interface Options {
    /** Credentials identifying the client and the flags available to it */
    clientSecret: string;
    /**
     * Pins flag resolution and event publishing to a region, for data residency.
     * Both services are placed, since events carry data of their own.
     *
     * Defaults to the global region.
     */
    region?: Region;
    /**
     * fetch-compatible transport. Also the way to reach a resolver of your own:
     * rewrite the URL here, since there is no url option.
     *
     * To use a Cloudflare service binding, wrap it rather than passing the method
     * itself — a detached `fetch` loses its receiver and Workers rejects it with
     * "Illegal invocation": `fetch: (...args) => env.ConfidenceBinding.fetch(...args)`.
     * A binding routes by binding rather than by hostname, so the Confidence
     * hostname in the request is ignored and only its path is used.
     */
    fetch?: typeof fetch;
    /** Optional logger. Nothing is logged when omitted. */
    logger?: Logger;
    /**
     * Identifies the caller to the resolver, so that a provider's traffic can be
     * told apart from direct use of this client. Defaults to this SDK's own name
     * and version.
     */
    sdk?: { name: SdkName; version: string };
  }

  /**
   * The outcome of a write — {@link (ConfidenceClient:class).apply} or
   * {@link (ConfidenceClient:class).publish}. Neither rejects, so this is how a
   * failure is reported.
   */
  export type WriteResult =
    | { ok: true }
    | {
        /** Delivery was not confirmed, or — when `errors` is set — some events were rejected */
        ok: false;
        /** `TIMEOUT` when the signal aborted with a `TimeoutError` */
        errorCode: 'TIMEOUT' | 'GENERAL';
        /** Human-readable cause */
        errorMessage: string;
        /**
         * HTTP status. Absent for transport failures, timeouts and aborts, and
         * for an event the publisher rejected on an otherwise successful request.
         */
        status?: number;
        /**
         * The events that were rejected, by their index in the published batch.
         * Only a publish sets this, and only when the request itself succeeded:
         * the rest of the batch was recorded.
         */
        errors?: Array<{ index: number; errorMessage: string }>;
      };

  /** An event for {@link (ConfidenceClient:class).publish} */
  export interface Event {
    /** Event definition name, without the `eventDefinitions/` prefix */
    name: string;
    /** Arbitrary event data */
    payload?: EventPayload;
    /**
     * When the event happened. Defaults to the time the request is sent.
     *
     * Set it explicitly when publishing events that were queued: a batch would
     * otherwise restamp everything in it with the flush time.
     */
    eventTime?: Date;
  }

  /**
   * Event data, sent as arbitrary JSON.
   *
   * `context` is the well-known key Confidence attributes events by — it is what
   * joins an event to the flag exposures for the same targeting context. Nothing
   * enforces its presence, but events published without it cannot be attributed.
   */
  export type EventPayload = {
    /** The evaluation context the event happened in */
    context?: EvaluationContext;
    [key: string]: unknown;
  };
}

/** A per-event failure, as the publish endpoint reports them */
interface PublishError {
  index: number;
  reason: string;
  message: string;
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
  private readonly resolverUrl: string;
  private readonly eventsUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly logger?: Logger;
  private readonly sdk: Sdk;

  /** Create a client. Does no work */
  constructor(options: ConfidenceClient.Options) {
    this.clientSecret = options.clientSecret;
    this.resolverUrl = serviceUrl('resolver', options.region);
    this.eventsUrl = serviceUrl('events', options.region);
    // Wrapped, not `globalThis.fetch` directly: Cloudflare Workers reject a
    // detached `fetch` with "Illegal invocation: function called with incorrect
    // `this` reference", so capturing the bare function breaks every request
    // from inside a Worker. Resolved per call rather than bound here, so
    // constructing still does no work when the runtime has no global fetch.
    this.fetchImpl = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.logger = options.logger;
    // Falls back rather than trusting the name: a JS caller can pass anything,
    // and an unknown id would leave the resolver with no sdk at all.
    this.sdk = {
      id: (options.sdk && SDK_IDS[options.sdk.name]) ?? SdkId.SDK_ID_JS_CONFIDENCE,
      version: options.sdk?.version ?? DEFAULT_VERSION,
    };
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
        sdk: this.sdk,
      };
      const response = await this.post(
        `${this.resolverUrl}/v1/flags:resolve`,
        ResolveFlagsRequest.toJSON(request),
        options?.signal,
      );
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
   * {@link (ConfidenceClient:namespace).WriteResult} and are logged. Pass
   * `\{ signal: AbortSignal.timeout(1000) \}` to bound it.
   */
  async apply(
    resolveToken: string,
    flagNames: string | string[],
    options?: { signal?: AbortSignal },
  ): Promise<ConfidenceClient.WriteResult> {
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
        sdk: this.sdk,
      };
      await this.post(`${this.resolverUrl}/v1/flags:apply`, ApplyFlagsRequest.toJSON(request), options?.signal, true);
      return { ok: true };
    } catch (err) {
      this.logger?.warn?.('Apply failed, exposure was not recorded. %s', String(err));
      return writeError(err);
    }
  }

  /**
   * Publish one event, or a batch of them in a single request.
   *
   * Nothing is queued: the request goes out on call. Small writes use
   * `keepalive` to allow delivery during navigation, subject to browser quotas
   * and network availability. A batching layer
   * built on top owns the queue, and should set each event's
   * {@link (ConfidenceClient:namespace).Event.eventTime | eventTime} so a flush
   * does not restamp the batch.
   *
   * Attribution comes from
   * {@link (ConfidenceClient:namespace).EventPayload.context | payload.context}.
   *
   * There is no retry. A dropped event is reported and gone; callers who need
   * more can retry on a failed result.
   *
   * Never rejects — failures come back as
   * {@link (ConfidenceClient:namespace).WriteResult} and are logged. Note that
   * the publish endpoint rejects individual events in the body of an HTTP 200: an
   * `ok: false` result may therefore carry no `status`, and when it names
   * `errors` the rest of the batch was recorded. Pass
   * `\{ signal: AbortSignal.timeout(1000) \}` to bound it.
   */
  async publish(
    event: ConfidenceClient.Event | ConfidenceClient.Event[],
    options?: { signal?: AbortSignal },
  ): Promise<ConfidenceClient.WriteResult> {
    const events = Array.isArray(event) ? event : [event];
    // Nothing to publish — save the round trip, as `apply` does for no flags.
    if (events.length === 0) return { ok: true };

    try {
      const sendTime = new Date();
      const response = await this.post(
        `${this.eventsUrl}/v1/events:publish`,
        {
          clientSecret: this.clientSecret,
          sendTime: sendTime.toISOString(),
          events: events.map(({ name, payload, eventTime }) => ({
            eventDefinition: EVENT_PREFIX + name,
            // A direct publish happens as it is sent; only a queued one differs.
            eventTime: (eventTime ?? sendTime).toISOString(),
            payload: payload ?? {},
          })),
        },
        options?.signal,
        true,
      );

      // The publish endpoint answers 200 and reports per-event failures in the
      // body, so an ok response is not yet a recorded event.
      const body = await response.text();
      const result: unknown = body.trim() ? JSON.parse(body) : {};
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw new Error('Invalid publish response');
      }
      const { errors } = result as { errors?: PublishError[] };
      if (errors !== undefined && !Array.isArray(errors)) throw new Error('Invalid publish errors');
      if (
        errors?.some(
          error => !error || !Number.isInteger(error.index) || error.index < 0 || error.index >= events.length,
        )
      ) {
        throw new Error('Invalid publish error index');
      }
      if (errors?.length) {
        const rejected = errors.map(({ index, reason, message }) => ({
          index,
          errorMessage: `Confidence rejected event "${events[index]?.name ?? index}": ${message || reason}`,
        }));
        const errorMessage = rejected.map(({ errorMessage }) => errorMessage).join('; ');
        this.logger?.warn?.(
          'Publish failed, %s of %s event(s) were not recorded. %s',
          rejected.length,
          events.length,
          errorMessage,
        );
        return { ok: false, errorCode: 'GENERAL', errorMessage, errors: rejected };
      }
      return { ok: true };
    } catch (err) {
      this.logger?.warn?.('Publish failed, %s event(s) were not recorded. %s', events.length, String(err));
      return writeError(err);
    }
  }

  private async post(url: string, body: unknown, signal?: AbortSignal, keepalive = false): Promise<Response> {
    const payload = JSON.stringify(body);
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal,
      keepalive: keepalive && new Blob([payload]).size <= KEEPALIVE_MAX_BODY_BYTES,
    });
    if (!response.ok) {
      // The resolver returns diagnostics as the body (e.g. "client secret not
      // found: requested=..., available=[...]") — worth surfacing.
      const detail = await response.text().catch(() => '');
      throw new HttpError(
        response.status,
        `Confidence ${url} failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`,
      );
    }
    return response;
  }
}

/** Shared by the write methods, which report failures rather than throwing them */
function writeError(err: unknown): ConfidenceClient.WriteResult {
  return {
    ok: false,
    errorCode: isTimeout(err) ? 'TIMEOUT' : 'GENERAL',
    errorMessage: String(err),
    status: err instanceof HttpError ? err.status : undefined,
  };
}

/**
 * Carries the status through to {@link (ConfidenceClient:namespace).WriteResult},
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
