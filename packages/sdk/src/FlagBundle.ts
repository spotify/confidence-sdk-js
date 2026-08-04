import { Logger } from './logger';

/**
 * The result of resolving a set of flags: plain JSON, so a server can resolve
 * once and forward the whole thing to a browser to evaluate.
 *
 * Bundles are produced by `ConfidenceClient.resolve`. This module is pure — it
 * has no transport and no credentials — so it is safe to reach for from browser
 * code that only ever evaluates a forwarded bundle.
 * @public
 */
export interface FlagBundle {
  /** Resolved flags, keyed by flag name without the `flags/` prefix */
  flags: Record<string, FlagBundle.Details<FlagBundle.Struct | null> | undefined>;
  /** Unique identifier for the resolve that produced this bundle */
  resolveId: string;
  /**
   * Base64 of the opaque token to pass to `ConfidenceClient.apply`. Empty when
   * the resolve already applied.
   */
  resolveToken: string;
  /** Set when the resolve failed; every evaluation then yields its default */
  errorCode?: FlagBundle.ErrorCode;
  /** Set when the resolve failed */
  errorMessage?: string;
}

/**
 * Types and evaluation for {@link (FlagBundle:interface)}
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace FlagBundle {
  /** Error code for a flag that could not be evaluated */
  export type ErrorCode = 'FLAG_NOT_FOUND' | 'TYPE_MISMATCH' | 'TIMEOUT' | 'GENERAL';

  /** Why a flag resolved the way it did */
  export type Reason =
    | 'ERROR'
    | 'FLAG_ARCHIVED'
    | 'MATCH'
    | 'NO_SEGMENT_MATCH'
    | 'TARGETING_KEY_ERROR'
    | 'NO_TREATMENT_MATCH'
    | 'UNSPECIFIED';

  /** Primitive flag value */
  export type Primitive = null | boolean | string | number;
  /** Object flag value */
  export type Struct = { [key: string]: Value };
  /** A flag value. The resolver never returns arrays */
  export type Value = Primitive | Struct;

  /** The outcome of resolving or evaluating a single flag */
  export interface Details<T> {
    /** Why the flag resolved the way it did */
    reason: Reason;
    /** The resolved value, or the default when the flag could not be evaluated */
    value: T;
    /** The assigned variant, e.g. `flags/my-flag/variants/treatment` */
    variant?: string;
    /** Set when the flag could not be evaluated */
    errorCode?: ErrorCode;
    /** Set when the flag could not be evaluated */
    errorMessage?: string;
    /** Whether evaluating this flag should count as an exposure */
    shouldApply: boolean;
    /** The rule that produced the assignment */
    assignmentOrigin?: string;
  }

  /**
   * Evaluate a flag key against a resolved bundle, with a typed default.
   *
   * A pure function with no I/O — it works on a bundle that was JSON-forwarded
   * from the server, so a browser can evaluate without resolving again. Never
   * throws: errors surface as the default value with an `ERROR` reason.
   *
   * @param bundle - a bundle from `ConfidenceClient.resolve`
   * @param flagKey - `'my-flag'` or a dot path into the value, `'my-flag.some.field'`
   * @param defaultValue - returned whenever the flag cannot be evaluated
   * @param logger - optional logger for evaluation failures
   */
  export function evaluate<T extends Value>(
    bundle: FlagBundle,
    flagKey: string,
    defaultValue: T,
    logger?: Logger,
  ): Details<T> {
    const [flagName, ...path] = flagKey.split('.');
    const flag = bundle?.flags[flagName];

    if (bundle?.errorCode) {
      logger?.warn?.(`Flag evaluation for "%s" failed. %s %s`, flagKey, bundle.errorCode, bundle?.errorMessage);
      return {
        reason: 'ERROR',
        errorCode: bundle.errorCode,
        errorMessage: bundle.errorMessage,
        value: defaultValue,
        shouldApply: false,
      };
    }

    if (!flag) {
      logger?.warn?.(`Flag evaluation for '${flagKey}' failed: flag not found`);
      return {
        reason: 'ERROR',
        errorCode: 'FLAG_NOT_FOUND',
        value: defaultValue,
        shouldApply: false,
      };
    }

    let value: Value = flag.value;
    for (let i = 0; i < path.length; i++) {
      if (value === null || typeof value !== 'object') {
        return {
          reason: 'ERROR',
          value: defaultValue,
          errorCode: 'TYPE_MISMATCH',
          errorMessage: `resolved value is not an object at ${[flagName, ...path.slice(0, i)].join('.')}`,
          shouldApply: false,
        };
      }
      value = value[path[i]];
    }

    try {
      return {
        ...flag,
        value: evaluateAssignment(value, defaultValue, [flagName, ...path]),
      };
    } catch (e) {
      return {
        reason: 'ERROR',
        value: defaultValue,
        errorCode: 'TYPE_MISMATCH',
        errorMessage: e instanceof Error ? e.message : String(e),
        shouldApply: false,
      };
    }
  }
}

function evaluateAssignment<T extends FlagBundle.Value>(
  resolvedValue: FlagBundle.Value,
  defaultValue: T,
  path: string[],
): T {
  const resolvedType = typeof resolvedValue;
  const defaultType = typeof defaultValue;

  // Guards JS callers; TypeScript rejects array defaults at compile time.
  if (Array.isArray(defaultValue)) {
    throw new Error(`arrays are not supported as flag values at ${path.join('.')}`);
  }

  // If default is null, any value is acceptable
  if (defaultValue === null) return resolvedValue as T;

  // If resolved is null, substitute default
  if (resolvedValue === null) return defaultValue;

  if (resolvedType !== defaultType) {
    throw new Error(
      `resolved value (${resolvedType}) isn't assignable to default type (${defaultType}) at ${path.join('.')}`,
    );
  }

  if (typeof resolvedValue === 'object') {
    const result: FlagBundle.Struct = { ...resolvedValue };
    for (const [key, value] of Object.entries(defaultValue as FlagBundle.Struct)) {
      if (!(key in resolvedValue)) {
        throw new Error(`resolved value is missing field "${key}" at ${path.join('.')}`);
      }
      result[key] = evaluateAssignment(resolvedValue[key], value, [...path, key]);
    }
    return result as T;
  }

  // Primitives — type match already validated
  return resolvedValue as T;
}
