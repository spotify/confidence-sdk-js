interface ConfidenceFlagEntry {
  variant: string;
}

interface ConfidenceGlobal {
  flags?: Record<string, ConfidenceFlagEntry>;
}

declare global {
  interface Window {
    __confidence?: ConfidenceGlobal;
  }
}

export function publishFlagEvaluation(name: string, variant: string): void {
  if (typeof window === 'undefined') return;
  (window as any).__confidence ??= {};
  const confidence = (window as any).__confidence as ConfidenceGlobal;
  confidence.flags ??= {};
  if (confidence.flags[name]?.variant === variant) return;
  confidence.flags[name] = { variant };
}
