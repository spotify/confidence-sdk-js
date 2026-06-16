const SEGMENT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, replacement: ':uuid' },
  { pattern: /^\d+$/, replacement: ':id' },
  // AIP-122 generated IDs: 20-char lowercase alphanumeric starting with a letter
  { pattern: /^[a-z][a-z0-9]{19}$/, replacement: ':id' },
  { pattern: /[0-9a-f]{20}/i, replacement: ':id' },
];

export function defaultParameterizeRoute(route: string): string {
  return route
    .split('/')
    .map(segment => {
      if (!segment) return segment;
      for (const { pattern, replacement } of SEGMENT_PATTERNS) {
        if (pattern.test(segment)) return replacement;
      }
      return segment;
    })
    .join('/');
}
