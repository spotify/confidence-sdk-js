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

  export function get(struct: Struct | undefined, path: string): Value;
  export function get(struct: Struct | undefined, ...steps: string[]): Value;
  export function get(struct: Struct | undefined, ...parts: string[]): Value {
    let value: Value = struct;
    const errorPath: string[] = [];
    for (const step of parts.flatMap(part => part.split('.'))) {
      TypeMismatchError.try('Struct', value, errorPath);
      value = value[step];
      errorPath.push(step);
    }
    return value;
  }
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Value = Value.Primitive | Value.Struct | Value.List;

export interface SchemaMismatch {
  readonly path: string;
  readonly expected?: Value.TypeName;
  readonly actual?: Value.TypeName;
}

export class TypeMismatchError {
  // private readonly code = 'TYPE_MISMATCH';

  constructor(
    readonly expected: Value.TypeName,
    readonly actual: Value.TypeName = 'undefined',
    private readonly steps: Array<string | number> = [],
  ) {}

  get path(): string {
    return this.steps.reduce<string>(
      (path, step) => path + (typeof step === 'string' ? (path ? `.${step}` : step) : `[${step}]`),
      '',
    );
  }
  get message(): string {
    let message: string;
    if (this.expected !== 'undefined') {
      message = `Expected ${this.expected}`;
      if (this.actual) {
        message += `, but found ${this.actual}`;
      }
    } else {
      message = `Unexpected ${this.actual}`;
    }
    if (this.steps.length) {
      message += ` at path ${this.path}`;
    }
    // message += '.';
    return message;
  }

  static try(expected: 'undefined', found: Value, path?: string[]): asserts found is undefined;
  static try(expected: 'string', found: Value, path?: string[]): asserts found is string;
  static try(expected: 'number', found: Value, path?: string[]): asserts found is number;
  static try(expected: 'boolean', found: Value, path?: string[]): asserts found is boolean;
  static try(expected: 'List', found: Value, path?: string[]): asserts found is Value.List;
  static try(expected: 'Struct', found: Value, path?: string[]): asserts found is Value.Struct;
  static try(expected: Value.TypeName, found: Value, path: string[] = []): asserts found is Value {
    const actual = Value.getType(found);
    if (expected !== actual) {
      throw new TypeMismatchError(expected, actual, path);
    }
  }

  static hoist<T>(step: string | number, fn: () => T): T {
    try {
      return fn();
    } catch (err) {
      if (err instanceof TypeMismatchError) {
        err = new TypeMismatchError(err.expected, err.actual, [step, ...err.steps]);
      }
      throw err;
    }
  }
}

export abstract class Schema<T extends Value = Value> {
  // abstract checkAssignsTo(value: Value): Schema.Mismatch | undefined;
  // abstract typeName:Value.TypeName

  constructor(readonly typeName: Value.TypeName) {}
  abstract assertAssignsTo(value: Value): void;

  get(path: string): Schema;
  get(...steps: string[]): Schema;
  get(...parts: string[]): Schema {
    const steps = parts.flatMap(part => part.split('.'));
    if (steps.length === 0) return this;
    throw new TypeMismatchError('Struct', this.typeName);
  }
}
export namespace Schema {
  export interface Mismatch {
    readonly path: string;
    readonly expected?: Value.TypeName;
    readonly actual?: Value.TypeName;
  }

  class Struct extends Schema {
    constructor(private readonly fields: Record<string, Schema>) {
      super('Struct');
    }
    assertAssignsTo(value: Value): void {
      TypeMismatchError.try('Struct', value);
      for (const key of Object.keys(value)) {
        const fieldSchema = this.fields[key];
        TypeMismatchError.hoist(key, () => {
          if (!fieldSchema) {
            TypeMismatchError.try('undefined', value);
          } else {
            fieldSchema.assertAssignsTo(value[key]);
          }
        });
      }
    }

    get(...path: string[]): Schema {
      const steps = path.flatMap(step => step.split('.'));
      if (steps.length === 0) return this;
      const [step, ...rest] = steps;
      const fieldSchema = this.fields[step];
      return TypeMismatchError.hoist(step, () => {
        if (!fieldSchema) throw new TypeMismatchError('Struct');
        return fieldSchema.get(...rest);
      });
    }
  }

  class List extends Schema {
    constructor(private readonly itemSchema: Schema) {
      super('List');
    }

    assertAssignsTo(value: Value): void {
      TypeMismatchError.try('List', value);
      for (let i = 0; i < value.length; i++) {
        TypeMismatchError.hoist(i, () => {
          this.itemSchema.assertAssignsTo(value[i]);
        });
      }
    }
  }
  class Primitive extends Schema {
    constructor(typeName: 'string' | 'boolean' | 'number') {
      super(typeName);
    }

    assertAssignsTo(value: Value): void {
      TypeMismatchError.try(this.typeName as any, value);
    }
  }

  export const BOOLEAN: Schema<boolean> = new Primitive('boolean');
  export const STRING: Schema<string> = new Primitive('string');
  export const NUMBER: Schema<number> = new Primitive('number');

  type StructType<T> = {} & { -readonly [P in keyof T]: T[P] extends Schema<infer S> ? S : never };
  export function struct<const T extends Record<string, Schema>>(fields: T): Schema<StructType<T>> {
    return new Struct(fields);
  }

  export function list<const T extends Value>(itemSchema: Schema<T>): Schema<T[]> {
    return new List(itemSchema);
  }
}
