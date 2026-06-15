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
