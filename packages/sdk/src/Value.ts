import { TypeMismatchError } from './error';

export namespace Value {
  // TODO should lists be able to contain Structs?
  const LIST_ITEM_TYPES = new Set(['number', 'string', 'boolean']);

  export type TypeName = 'number' | 'string' | 'boolean' | 'Struct' | 'List' | 'undefined';
  // TODO add Date
  export type Primitive = number | string | boolean;
  export type Struct = {
    readonly [key: string]: Value;
  };
  export type List = ReadonlyArray<number> | ReadonlyArray<string> | ReadonlyArray<boolean>;

  export type Widen<T extends Value> = T extends number
    ? number
    : T extends string
    ? string
    : T extends boolean
    ? boolean
    : T;

  export function assertValue(value: unknown): asserts value is Value {
    switch (typeof value) {
      case 'bigint':
      case 'symbol':
      case 'function':
        throw new TypeMismatchError('number | boolean | string | Struct | List', typeof value);
      case 'object':
        if (value === null) throw new TypeMismatchError('number | boolean | string | Struct | List', 'null');
        if (Array.isArray(value)) {
          if (value.length > 0) {
            const itemType = getType(value[0]);
            if (!LIST_ITEM_TYPES.has(itemType)) {
              throw new TypeMismatchError('number | boolean | string', itemType, [0]);
            }
            for (let i = 1; i < value.length; i++) {
              const type = getType(value[i]);
              if (type !== itemType) {
                throw new TypeMismatchError(itemType, type, [i]);
              }
            }
          }
        }
        for (const key in value) {
          if (Object.prototype.hasOwnProperty.call(value, key)) {
            TypeMismatchError.hoist(key, () => assertValue(value[key as keyof typeof value] as unknown));
          }
        }
        return;
      default: // no-op
    }
  }

  export function clone<T extends Value>(value: T): T {
    if (isStruct(value)) {
      const cloned: Record<string, Value> = {};
      for (const key of Object.keys(value)) {
        cloned[key] = clone(value[key]);
      }
      return Object.freeze(cloned) as T;
    }
    if (isList(value)) {
      return Object.freeze(value.map(clone)) as T;
    }
    return value;
  }

  export function equal(value1: Value, value2: Value): boolean {
    if (value1 === value2) return true;
    const type = getType(value1);
    if (getType(value2) !== type) return false;
    if (type === 'Struct') {
      return structsEqual(value1 as Struct, value2 as Struct);
    }
    if (type === 'List') {
      return listsEqual(value1 as List, value2 as List);
    }
    return false;
  }

  function structsEqual(struct1: Struct, struct2: Struct): boolean {
    const keys = Object.keys(struct1);
    if (Object.keys(struct2).length !== keys.length) return false;
    for (const key of keys) {
      if (!equal(struct1[key], struct2[key])) return false;
    }
    return true;
  }

  function listsEqual(list1: List, list2: List): boolean {
    const length = list1.length;
    if (list2.length !== length) return false;
    for (let i = 0; i < length; i++) {
      if (!equal(list1[i], list2[i])) return false;
    }
    return true;
  }

  export function getType(value: Value): TypeName {
    const jsType = typeof value;
    switch (jsType) {
      case 'boolean':
      case 'number':
      case 'string':
      case 'undefined':
        return jsType;
      case 'object':
        return Array.isArray(value) ? 'List' : 'Struct';
      default: // no-op
    }
    throw new TypeError(`Invalid Value type "${jsType}"`);
  }

  export function isStruct(value: Value): value is Struct {
    return Value.getType(value) === 'Struct';
  }

  export function isList(value: Value): value is List {
    return Value.getType(value) === 'List';
  }

  export function assertType(expected: 'undefined', found: Value): asserts found is undefined;
  export function assertType(expected: 'string', found: Value): asserts found is string;
  export function assertType(expected: 'number', found: Value): asserts found is number;
  export function assertType(expected: 'boolean', found: Value): asserts found is boolean;
  export function assertType(expected: 'List', found: Value): asserts found is List;
  export function assertType(expected: 'Struct', found: Value): asserts found is Struct;
  export function assertType(expected: TypeName, found: Value): asserts found is Value {
    const actual = Value.getType(found);
    if (expected !== actual) {
      throw new TypeMismatchError(expected, actual);
    }
  }

  export function get(struct: Struct | undefined, path: string): Value;
  export function get(struct: Struct | undefined, ...steps: string[]): Value;
  export function get(struct: Struct | undefined, ...parts: string[]): Value {
    let value: Value = struct;
    const errorPath: string[] = [];
    /* eslint-disable no-loop-func */
    for (const step of parts.flatMap(part => part.split('.'))) {
      TypeMismatchError.hoist(errorPath, () => {
        assertType('Struct', value);
        value = value[step];
        errorPath.push(step);
      });
    }
    /* eslint-enable no-loop-func */
    return value;
  }
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Value = Value.Primitive | Value.Struct | Value.List | undefined;
