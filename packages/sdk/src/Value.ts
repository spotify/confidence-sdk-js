export namespace Value {
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

  export function isAssignable<T extends Value>(value: Value, schema: T): value is schema {
    if (isStruct(schema)) {
      if (!isStruct(value)) return false;
      for (const key of Object.keys(schema)) {
        if (!isAssignable(value[key], schema[key])) return false;
      }
      return true;
    }
    if (isList(schema)) {
      if (!isList(value)) return false;
      return value.every(value => isAssignable(value, schema[0]));
    }
    const type = typeof schema;
    if (type === 'undefined') return true;
    return type === typeof value;
  }
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Value = Value.Primitive | Value.Struct | Value.List;
