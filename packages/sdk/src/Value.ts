export namespace Value {
  export type TypeName = 'number' | 'string' | 'boolean' | 'Struct' | 'List' | 'undefined';
  export type Primitive = number | string | boolean | undefined;
  export type Struct = {
    readonly [key: string]: Value;
  };
  export type List = ReadonlyArray<Value>;

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

  export function isStruct(value: Value): value is Struct {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  export function isList(value: Value): value is List {
    return typeof value === 'object' && value !== null && Array.isArray(value);
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
    }
    throw new TypeError(`Invalid Value type "${jsType}"`);
  }
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Value = Value.Primitive | Value.Struct | Value.List;
