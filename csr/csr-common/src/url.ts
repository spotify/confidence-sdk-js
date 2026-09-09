/** Remove query strings and fragments, including from relative or malformed URLs. */
export function stripUrlQueryAndHash(url: string): string {
  return url.split(/[?#]/, 1)[0];
}

/**
 * Extract only the pathname from a URL, stripping origin, query string, and
 * hash. Used across recorder and analyzer to avoid capturing PII in route data.
 */
export function stripUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch (_e) {
    return url;
  }
}
