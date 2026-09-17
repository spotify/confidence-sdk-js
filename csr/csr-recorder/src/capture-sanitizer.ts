import { stripUrlQueryAndHash } from '@spotify-confidence/csr-common';

export type CaptureSanitizer = boolean | ((value: string) => string);

type CaptureSource = 'console' | 'network';

const URL_IN_TEXT = /(?:(?:https?|wss?):)?\/\/[^\s<>"')\]}]+/giu;
const RELATIVE_URL_IN_TEXT = /(^|[\s("'=])(\/(?!\/)[^\s<>"')\]}]*[?#][^\s<>"')\]}]*)/giu;

function stripUrlQueryAndHashFromText(value: string): string {
  return value
    .replace(URL_IN_TEXT, url => stripUrlQueryAndHash(url))
    .replace(RELATIVE_URL_IN_TEXT, (_match, prefix: string, url: string) => prefix + stripUrlQueryAndHash(url));
}

function applyBuiltInSanitizer(value: string, source: CaptureSource): string {
  if (source === 'network') return stripUrlQueryAndHash(value);
  return stripUrlQueryAndHashFromText(value);
}

function logSanitizerFailure(source: CaptureSource, debugLogger?: (message: string) => void): void {
  try {
    debugLogger?.(`SECURITY: ${source} sanitizer failed; captured event dropped`);
  } catch (_error) {
    // Diagnostics must never affect the host application.
  }
}

export function createOnceCaptureLogger(
  debugLogger?: (message: string) => void,
): ((message: string) => void) | undefined {
  if (!debugLogger) return undefined;

  let hasLogged = false;
  return message => {
    if (hasLogged) return;
    hasLogged = true;
    try {
      debugLogger(message);
    } catch (_error) {
      // Diagnostics must never affect the host application.
    }
  };
}

export function sanitizeCapturedValue(
  value: string,
  sanitizer: CaptureSanitizer | undefined,
  source: CaptureSource,
  debugLogger?: (message: string) => void,
): string | undefined {
  if (!sanitizer) return value;

  try {
    const sanitized = sanitizer === true ? applyBuiltInSanitizer(value, source) : sanitizer(value);

    if (typeof sanitized !== 'string') throw new TypeError('Sanitizer must return a string');
    return sanitized;
  } catch (_error) {
    logSanitizerFailure(source, debugLogger);
    return undefined;
  }
}

export function sanitizeCapturedValues(
  values: string[],
  sanitizer: CaptureSanitizer,
  source: CaptureSource,
  debugLogger?: (message: string) => void,
): string[] | undefined {
  const sanitizedValues: string[] = [];
  for (const value of values) {
    const sanitized = sanitizeCapturedValue(value, sanitizer, source, debugLogger);
    if (sanitized === undefined) return undefined;
    sanitizedValues.push(sanitized);
  }
  return sanitizedValues;
}
