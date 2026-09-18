import { stripUrlQueryAndHash } from '@spotify-confidence/csr-common';

export type CaptureSanitizer = boolean | ((value: string) => string);

/** Sanitizes one captured string, or returns `undefined` so the caller drops the event. */
export type ValueSanitizer = (value: string) => string | undefined;

type CaptureSource = 'console' | 'network';

const URL_IN_TEXT = /(?:(?:https?|wss?):)?\/\/[^\s<>"')\]}]+/giu;
const RELATIVE_URL_IN_TEXT = /(^|[\s("'=])(\/(?!\/)[^\s<>"')\]}]*[?#][^\s<>"')\]}]*)/giu;

function stripUrlsInText(value: string): string {
  return value
    .replace(URL_IN_TEXT, stripUrlQueryAndHash)
    .replace(RELATIVE_URL_IN_TEXT, (_match, prefix: string, url: string) => prefix + stripUrlQueryAndHash(url));
}

/**
 * Build the sanitizer for a capture channel, or `undefined` when that channel
 * stays raw. The result fails closed: it returns `undefined` when the sanitizer
 * throws or yields a non-string, and warns at most once per recording without
 * ever logging the unsanitized value.
 */
export function createValueSanitizer(
  sanitizer: CaptureSanitizer | undefined,
  source: CaptureSource,
  debugLogger?: (message: string) => void,
): ValueSanitizer | undefined {
  if (!sanitizer) return undefined;

  const builtIn = source === 'network' ? stripUrlQueryAndHash : stripUrlsInText;
  const sanitize = sanitizer === true ? builtIn : sanitizer;
  let hasWarned = false;

  return value => {
    try {
      const sanitized = sanitize(value);
      if (typeof sanitized !== 'string') throw new TypeError('Sanitizer must return a string');
      return sanitized;
    } catch (_error) {
      if (hasWarned) return undefined;
      hasWarned = true;
      try {
        debugLogger?.(`SECURITY: ${source} sanitizer failed; captured event dropped`);
      } catch (_loggerError) {
        // Diagnostics must never affect the host application.
      }
      return undefined;
    }
  };
}
