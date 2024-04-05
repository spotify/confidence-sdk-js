/* eslint-disable */
import { FlagSchema_StructFlagSchema } from '../../types/v1/types';
import { ResolveReason, Sdk } from './types';

export const protobufPackage = 'confidence.flags.resolver.v1';

export interface ResolveFlagsRequest {
  /**
   * If non-empty, the specific flags are resolved, otherwise all flags
   * available to the client will be resolved.
   */
  flags: string[];
  /**
   * An object that contains data used in the flag resolve. For example,
   * the targeting key e.g. the id of the randomization unit, other attributes
   * like country or version that are used for targeting.
   */
  evaluationContext: { [key: string]: any } | undefined;
  /**
   * Credentials for the client. It is used to identify the client and find
   * the flags that are available to it.
   */
  clientSecret: string;
  /**
   * Determines whether the flags should be applied directly as part of the
   * resolve, or delayed until `ApplyFlag` is called. A flag is typically
   * applied when it is used, if this occurs much later than the resolve, then
   * `apply` should likely be set to false.
   */
  apply: boolean;
  /** Information about the SDK used to initiate the request. */
  sdk: Sdk | undefined;
}

export interface ResolveFlagsResponse {
  /**
   * The list of all flags that could be resolved. Note: if any flag was
   * archived it will not be included in this list.
   */
  resolvedFlags: ResolvedFlag[];
  /**
   * An opaque token that is used when `apply` is set to false in `ResolveFlags`.
   * When `apply` is set to false, the token must be passed to `ApplyFlags`.
   */
  resolveToken: Uint8Array;
  /** Unique identifier for this particular resolve request. */
  resolveId: string;
}

export interface ApplyFlagsRequest {
  /** The flags to apply and information about when they were applied. */
  flags: AppliedFlag[];
  /** Credentials for the client. */
  clientSecret: string;
  /** An opaque token that was returned from `ResolveFlags`; it must be set. */
  resolveToken: Uint8Array;
  /**
   * The client time when the this request was sent, used for correcting
   * clock skew from the client.
   */
  sendTime: Date | undefined;
  /** Information about the SDK used to initiate the request. */
  sdk: Sdk | undefined;
}

export interface ApplyFlagsResponse {}

export interface AppliedFlag {
  /** The id of the flag that should be applied, has the format `flags/*`. */
  flag: string;
  /** The client time when the flag was applied. */
  applyTime: Date | undefined;
}

export interface ResolvedFlag {
  /** The id of the flag that as resolved. */
  flag: string;
  /** The id of the resolved variant has the format `flags/abc/variants/xyz`. */
  variant: string;
  /**
   * The value corresponding to the variant. It will always be a json object,
   * for example `{ "color": "red", "size": 12 }`.
   */
  value: { [key: string]: any } | undefined;
  /**
   * The schema of the value that was returned. For example:
   * ```
   * {
   *    "schema": {
   *      "color": { "stringSchema": {} },
   *      "size": { "intSchema": {} }
   *    }
   * }
   * ```
   */
  flagSchema: FlagSchema_StructFlagSchema | undefined;
  /** The reason to why the flag could be resolved or not. */
  reason: ResolveReason;
}
