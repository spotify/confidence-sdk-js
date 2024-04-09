import { TypeMismatchError } from './error';

export namespace Value {
  // type Distribute<T>
  export type TypeName = 'number' | 'string' | 'boolean' | 'Struct' | 'List' | 'undefined';
  export type Primitive = number | string | boolean;
  export type Struct = {
    readonly [key: string]: Value;
  };
  export type List = ReadonlyArray<number> | ReadonlyArray<string> | ReadonlyArray<boolean>;

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
    for (const step of parts.flatMap(part => part.split('.'))) {
      TypeMismatchError.hoist(errorPath, () => {
        assertType('Struct', value);
        value = value[step];
        errorPath.push(step);
      });
    }
    return value;
  }
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Value = Value.Primitive | Value.Struct | Value.List | undefined;
