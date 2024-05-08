import { Value } from './Value';
import { TypeMismatchError } from './error';
import { FlagSchema } from './generated/confidence/flags/types/v1/types';

export abstract class Schema<T extends Value = Value> {
  // abstract checkAssignsTo(value: Value): Schema.Mismatch | undefined;
  // abstract typeName:Value.TypeName

  constructor(readonly typeName: Value.TypeName) {}
  abstract assertAssignsTo(value: Value): void;

  // is(value: Value): value is T {}

  get(path: string): Schema;
  get(...steps: string[]): Schema;
  get(...parts: string[]): Schema {
    const steps = parts.flatMap(part => part.split('.'));
    if (steps.length === 0) return this;
    return Schema.UNDEFINED;
  }
}
export namespace Schema {
  // export interface Mismatch {
  //   readonly path: string;
  //   readonly expected?: Value.TypeName;
  //   readonly actual?: Value.TypeName;
  // }

  class Struct extends Schema {
    constructor(private readonly fields: Record<string, Schema>) {
      super('Struct');
    }
    assertAssignsTo(value: Value): void {
      Value.assertType('Struct', value);
      for (const key of Object.keys(value)) {
        const fieldSchema: Schema = this.fields[key];
        TypeMismatchError.hoist(key, () => {
          if (!fieldSchema) {
            Value.assertType('undefined', value);
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
        if (!fieldSchema) return UNDEFINED;
        return fieldSchema.get(...rest);
      });
    }

    // static infer<T extends Value.Struct>(value:T):Schema<T> {
    //   const fields:Record<string, Schema> = {};
    //   for(const key of Object.keys(value)) {
    //     if(typeof value[key] !== 'undefined') {
    //       fields[key] = infer(value[key])
    //     }
    //   }
    //   return struct(fields);
    // }
  }

  class List extends Schema {
    constructor(private readonly itemSchema: Schema) {
      super('List');
    }

    assertAssignsTo(value: Value): void {
      Value.assertType('List', value);
      for (let i = 0; i < value.length; i++) {
        TypeMismatchError.hoist(i, () => {
          this.itemSchema.assertAssignsTo(value[i]);
        });
      }
    }

    // static infer<T extends List>(value:T):Schema<T> {

    // }
  }
  class Primitive<T extends Value.Primitive> extends Schema<T> {
    assertAssignsTo(value: Value): void {
      Value.assertType(this.typeName as any, value);
    }
  }
  class Integer extends Primitive<number> {
    constructor() {
      super('number');
    }

    assertAssignsTo(value: Value): void {
      Value.assertType('number', value);
      if (!Number.isInteger(value)) {
        throw new TypeMismatchError('Integer', String(value));
      }
    }
  }

  class Any extends Schema {
    constructor() {
      super('undefined');
    }

    get(path: string): Schema<Value>;
    get(...steps: string[]): Schema<Value>;
    get(): Schema<Value> {
      return ANY;
    }

    assertAssignsTo(_value: Value): void {
      // no-op
    }
  }

  export const ANY: Schema<any> = new Any();
  export const UNDEFINED: Schema<boolean> = new Primitive('undefined');
  export const BOOLEAN: Schema<boolean> = new Primitive('boolean');
  export const STRING: Schema<string> = new Primitive('string');
  export const DOUBLE: Schema<number> = new Primitive('number');
  export const INTEGER: Schema<number> = new Integer();

  type StructType<T> = {} & { -readonly [P in keyof T]: T[P] extends Schema<infer S> ? S : never };
  export function struct<const T extends Record<string, Schema>>(fields: T): Schema<StructType<T>> {
    return new Struct(fields);
  }

  type ListType<T> = T extends Value.Primitive ? ReadonlyArray<T> : never;
  export function list<const T extends Value.Primitive>(itemSchema: Schema<T>): Schema<ListType<T>> {
    return new List(itemSchema);
  }

  export function parse(schema: FlagSchema): Schema {
    if (schema.boolSchema) {
      return Schema.BOOLEAN;
    }
    if (schema.doubleSchema) {
      return Schema.DOUBLE;
    }
    if (schema.intSchema) {
      return Schema.INTEGER;
    }
    if (schema.stringSchema) {
      return Schema.STRING;
    }
    if (schema.listSchema) {
      if (!schema.listSchema.elementSchema) throw new TypeError('ListSchema must specify an elementSchema');
      return list(parse(schema.listSchema.elementSchema));
    }
    if (schema.structSchema) {
      return struct(mapValues(schema.structSchema.schema, parse));
    }
    throw new TypeError(`Unknown schema type ${schema}`);
  }

  // export function infer<T extends Value>(value:T):Schema<T> {
  //   return Value.match(value, {
  //     'string': () => STRING,
  //     'boolean': () => BOOLEAN,
  //     'Struct': Struct.infer,
  //     'List': List.infer
  //   })
  // }
}

function mapValues<T, U>(record: Record<string, T>, callb: (value: T, key: string) => U): Record<string, U> {
  const mapped: Record<string, U> = {};
  for (const key of Object.keys(record)) {
    mapped[key] = callb(record[key], key);
  }
  return mapped;
}
