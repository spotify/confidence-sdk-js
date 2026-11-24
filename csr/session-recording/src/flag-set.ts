import type { FlagWrite } from './flag-observer';

export type FlagAssignment = { variant: string; assignmentOrigin?: string };

const FLAG_PREFIX = 'flags/';

export interface FlagSet {
  /** Merges `flags` in and returns the writes whose variant changed. */
  set(flags: Record<string, FlagAssignment>): FlagWrite[];
  all(): FlagWrite[];
}

export function createFlagSet(debugLogger?: (msg: string) => void): FlagSet {
  const current = new Map<string, FlagWrite>();
  return {
    set(flags) {
      const changed: FlagWrite[] = [];
      for (const [name, assignment] of Object.entries(flags ?? {})) {
        if (!name || typeof assignment?.variant !== 'string') {
          debugLogger?.(`setFlags: ignored '${name}', variant must be a string`);
          continue;
        }
        const flagKey = name.startsWith(FLAG_PREFIX) ? name : FLAG_PREFIX + name;
        const assignmentOrigin = assignment.assignmentOrigin ?? '';
        const previous = current.get(flagKey);
        if (previous?.variant === assignment.variant && previous.assignmentOrigin === assignmentOrigin) continue;
        const write = { flagKey, variant: assignment.variant, assignmentOrigin };
        current.set(flagKey, write);
        changed.push(write);
      }
      return changed;
    },
    all() {
      return [...current.values()];
    },
  };
}
