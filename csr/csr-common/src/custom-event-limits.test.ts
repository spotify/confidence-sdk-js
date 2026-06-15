import { describe, it, expect } from 'vitest';
import {
  validateKey,
  validateTagValue,
  validateMeasureValue,
  MAX_KEY_LENGTH,
  MAX_TAG_VALUE_LENGTH,
} from './custom-event-limits';

describe('validateKey', () => {
  it('accepts valid keys', () => {
    expect(validateKey('page_view')).toBeNull();
    expect(validateKey('click.count')).toBeNull();
    expect(validateKey('my-feature')).toBeNull();
    expect(validateKey('A1')).toBeNull();
  });

  it('rejects empty key', () => {
    expect(validateKey('')).toBe('key is empty');
  });

  it('rejects key exceeding max length', () => {
    expect(validateKey('a'.repeat(MAX_KEY_LENGTH + 1))).toContain('exceeds');
  });

  it('accepts key at max length', () => {
    expect(validateKey('a'.repeat(MAX_KEY_LENGTH))).toBeNull();
  });

  it('rejects keys with invalid characters', () => {
    expect(validateKey('has space')).toContain('invalid characters');
    expect(validateKey('key=val')).toContain('invalid characters');
    expect(validateKey('a/b')).toContain('invalid characters');
    expect(validateKey('<script>')).toContain('invalid characters');
  });
});

describe('validateTagValue', () => {
  it('accepts undefined', () => {
    expect(validateTagValue(undefined)).toBeNull();
  });

  it('accepts valid string', () => {
    expect(validateTagValue('hello')).toBeNull();
  });

  it('accepts empty string', () => {
    expect(validateTagValue('')).toBeNull();
  });

  it('rejects value exceeding max length', () => {
    expect(validateTagValue('x'.repeat(MAX_TAG_VALUE_LENGTH + 1))).toContain('exceeds');
  });

  it('accepts value at max length', () => {
    expect(validateTagValue('x'.repeat(MAX_TAG_VALUE_LENGTH))).toBeNull();
  });
});

describe('validateMeasureValue', () => {
  it('accepts undefined', () => {
    expect(validateMeasureValue(undefined)).toBeNull();
  });

  it('accepts finite numbers', () => {
    expect(validateMeasureValue(0)).toBeNull();
    expect(validateMeasureValue(42)).toBeNull();
    expect(validateMeasureValue(-1.5)).toBeNull();
  });

  it('rejects NaN', () => {
    expect(validateMeasureValue(NaN)).toContain('finite');
  });

  it('rejects Infinity', () => {
    expect(validateMeasureValue(Infinity)).toContain('finite');
    expect(validateMeasureValue(-Infinity)).toContain('finite');
  });
});
