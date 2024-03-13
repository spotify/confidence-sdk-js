export type Value = Value.Primitive | Value.Struct | Value.List;
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
    return typeof value == 'object' && value !== null && !Array.isArray(value);
  }

  export function isList(value: Value): value is List {
    return typeof value == 'object' && value !== null && Array.isArray(value);
  }
}
