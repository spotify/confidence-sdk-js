import type { ConfidenceGlobal } from './confidence-global';

export function publishFlagEvaluation(name: string, variant: string, assignmentOrigin: string): void {
  if (typeof window === 'undefined') return;
  (window as any).__confidence ??= {};
  const confidence = (window as any).__confidence as ConfidenceGlobal;
  confidence.flags ??= {};
  if (confidence.flags[name]?.variant === variant) return;
  confidence.flags[name] = { variant, assignmentOrigin };
}
