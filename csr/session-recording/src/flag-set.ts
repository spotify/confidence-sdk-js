import { observeFlags, type FlagWrite } from './flag-observer';

export type FlagAssignment = { variant: string; assignmentOrigin?: string };

const FLAG_PREFIX = 'flags/';

export interface FlagSet {
  /** Merges `flags` in and returns the writes whose variant changed. */
  set(flags: Record<string, FlagAssignment>): FlagWrite[];
  /** Stores `write` and returns whether it changed the flag's assignment. */
  record(write: FlagWrite): boolean;
  all(): FlagWrite[];
}

export function createFlagSet(debugLogger?: (msg: string) => void): FlagSet {
  const current = new Map<string, FlagWrite>();
  const record = (write: FlagWrite): boolean => {
    const previous = current.get(write.flagKey);
    if (previous?.variant === write.variant && previous.assignmentOrigin === write.assignmentOrigin) return false;
    current.set(write.flagKey, write);
    return true;
  };
  return {
    record,
    set(flags) {
      const changed: FlagWrite[] = [];
      for (const [name, assignment] of Object.entries(flags ?? {})) {
        if (!name || typeof assignment?.variant !== 'string') {
          debugLogger?.(`setFlags: ignored '${name}', variant must be a string`);
          continue;
        }
        const flagKey = name.startsWith(FLAG_PREFIX) ? name : FLAG_PREFIX + name;
        const variant = assignment.variant.startsWith(FLAG_PREFIX)
          ? assignment.variant
          : `${flagKey}/variants/${assignment.variant}`;
        const write = { flagKey, variant, assignmentOrigin: assignment.assignmentOrigin ?? '' };
        if (record(write)) changed.push(write);
      }
      return changed;
    },
    all() {
      return [...current.values()];
    },
  };
}

/**
 * Observes `window.__confidence.flags` into `flags`, so both sources share one latest assignment
 * per flag, then emits every current assignment for the new recording.
 */
export function observeFlagsInto(flags: FlagSet, emit: (write: FlagWrite) => void): () => void {
  let replaying = true;
  const stop = observeFlags(write => {
    if (flags.record(write) && !replaying) emit(write);
  });
  replaying = false;
  flags.all().forEach(emit);
  return stop;
}
