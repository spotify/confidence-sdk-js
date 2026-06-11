export const MAX_KEY_LENGTH = 128;
export const MAX_TAG_VALUE_LENGTH = 256;
export const MAX_DISTINCT_KEYS = 100;
export const MAX_VALUES_PER_KEY = 1000;
const VALID_KEY_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export function validateKey(key: string): string | null {
  if (typeof key !== 'string' || key.length === 0) return 'key is empty';
  if (key.length > MAX_KEY_LENGTH)
    return `key exceeds ${MAX_KEY_LENGTH} characters`;
  if (!VALID_KEY_PATTERN.test(key))
    return 'key contains invalid characters (allowed: a-z A-Z 0-9 _ . -)';
  return null;
}

export function validateTagValue(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') return 'tag value is not a string';
  if (value.length > MAX_TAG_VALUE_LENGTH)
    return `tag value exceeds ${MAX_TAG_VALUE_LENGTH} characters`;
  return null;
}

export function validateMeasureValue(value: number | undefined): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value))
    return 'measure value must be a finite number';
  return null;
}
