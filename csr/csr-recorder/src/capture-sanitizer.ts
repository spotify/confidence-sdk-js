import { stripUrlQueryAndHash } from '@spotify-confidence/csr-common';

/** Capture option: `true` for the built-in policy, or a customer-defined function. */
export type CaptureSanitizer = boolean | ((value: string) => string);

/** Sanitizes one captured string. Throws when the policy fails, which drops the whole event. */
export type ValueSanitizer = (value: string) => string;

type CaptureSource = 'console' | 'network';

const URL_IN_TEXT = /(?:(?:https?|wss?):)?\/\/[^\s<>"')\]}]+/giu;
const RELATIVE_URL_IN_TEXT = /(^|[\s("'=])(\/(?!\/)[^\s<>"')\]}]*[?#][^\s<>"')\]}]*)/giu;

/** Remove query strings and fragments from every URL found inside free text. */
export function stripUrlsInText(value: string): string {
  return value
    .replace(URL_IN_TEXT, stripUrlQueryAndHash)
    .replace(RELATIVE_URL_IN_TEXT, (_match, prefix: string, url: string) => prefix + stripUrlQueryAndHash(url));
}

const BUILT_IN: Record<CaptureSource, ValueSanitizer> = {
  network: stripUrlQueryAndHash,
  console: stripUrlsInText,
};

/** The sanitizer for one capture channel, or `undefined` when that channel stays raw. */
export function getValueSanitizer(
  sanitizer: CaptureSanitizer | undefined,
  source: CaptureSource,
): ValueSanitizer | undefined {
  if (!sanitizer) return undefined;

  const sanitize = sanitizer === true ? BUILT_IN[source] : sanitizer;
  return value => {
    const sanitized = sanitize(value);
    if (typeof sanitized !== 'string') throw new TypeError('Sanitizer must return a string');
    return sanitized;
  };
}

/** Log at most once. Diagnostics must never reach the host application. */
export function createOnceLogger(debugLogger?: (message: string) => void): (message: string) => void {
  let hasLogged = false;
  return message => {
    if (hasLogged) return;
    hasLogged = true;
    try {
      debugLogger?.(message);
    } catch (_error) {
      // Diagnostics must never affect the host application.
    }
  };
}

/** Build a captured event. Returns `undefined` when sanitizing threw, so the caller drops it. */
export function dropOnFailure<T>(
  build: () => T,
  warn: (message: string) => void,
  source: CaptureSource,
): T | undefined {
  try {
    return build();
  } catch (_error) {
    warn(`SECURITY: ${source} sanitizer failed; captured event dropped`);
    return undefined;
  }
}
