import { Schema } from './Schema';
import { Value } from './Value';

describe('Value', () => {
  describe('get', () => {
    const value = { a: { a: 'aa', b: { a: 'aba' } } };
    it('can get a value deep in a Struct', () => {
      expect(Value.get(value, 'a', 'a')).toBe('aa');
      expect(Value.get(value, 'a.b.a')).toBe('aba');
    });

    it('throws if it encounters a non Struct', () => {
      expect(() => {
        Value.get(value, 'a.a.b');
      }).toThrow(`Expected Struct, but found string, at path 'a.a'`);
    });

    it('can handle undefined', () => {
      expect(Value.serialize(undefined)).toBe('');
      expect(Value.deserialize('')).toBeUndefined();
    });
  });

  describe('serialization', () => {
    it('it produces a canonical string', () => {
      // @ts-expect-error
      const s0 = Value.serialize({ a: 1, b: 2, c: null });
      const s1 = Value.serialize({ b: 2, a: 1, c: undefined });
      expect(s0).toBe(s1);
    });

    it('can read back an equal copy', () => {
      const value: Value = {
        a: 'hello',
        b: 1234.56789,
        c: true,
        d: false,
        e: [0.1, 0.2, 0.345345],
      };
      const data = Value.serialize(value);
      const copy = Value.deserialize(data);
      expect(copy).toEqual(value);
    });
  });
});

describe('Schema', () => {
  const schema = Schema.struct({ a: Schema.struct({ a: Schema.STRING, b: Schema.list(Schema.DOUBLE) }) });

  it('can assert a value is assignable from the Schema type', () => {
    expect(() => schema.assertAssignsTo({})).not.toThrow();
    expect(() => schema.assertAssignsTo({ a: 3 })).toThrow(`Expected Struct, but found number, at path 'a'`);
    expect(() => schema.assertAssignsTo({ x: true })).toThrow(`Expected undefined, but found Struct, at path 'x'`);
    // @ts-expect-error
    expect(() => schema.assertAssignsTo({ a: { a: '', b: [0, 1, '2'] } })).toThrow(
      `Expected number, but found string, at path 'a.b[2]'`,
    );
  });

  it('can get nested part of the schema', () => {
    expect(schema.get('a', 'a')).toBe(Schema.STRING);
  });
});
