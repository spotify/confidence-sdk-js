const FLAG_PREFIX = 'flags/';

interface ConfidenceFlagEntry {
  variant: string;
  assignmentOrigin: string;
}

interface ConfidenceGlobal {
  flags?: Record<string, ConfidenceFlagEntry>;
}

declare global {
  interface Window {
    __confidence?: ConfidenceGlobal;
  }
}

/**
 * Records an evaluated flag under `window.__confidence.flags`, where Confidence
 * developer tooling reads which variant a page actually rendered.
 *
 * A no-op outside a browser, and cheap enough to call on every evaluation — an
 * entry is only rewritten when the variant changed. Call it for assignments
 * only: a flag that fell back to its default was never assigned a variant and
 * should be left out.
 *
 * @param flagName - flag name, without the `flags/` prefix
 * @param variant - the assigned variant, e.g. `flags/my-flag/variants/treatment`
 * @param assignmentOrigin - the rule that produced the assignment
 * @public
 */
export function publishFlagEvaluation(flagName: string, variant: string, assignmentOrigin: string): void {
  if (typeof window === 'undefined') return;
  const name = FLAG_PREFIX + flagName;
  (window as any).__confidence ??= {};
  const confidence = (window as any).__confidence as ConfidenceGlobal;
  confidence.flags ??= {};
  if (confidence.flags[name]?.variant === variant) return;
  confidence.flags[name] = { variant, assignmentOrigin };
}
