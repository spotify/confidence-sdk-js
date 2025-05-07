import { TypeMismatchError } from './error';

/**
 * Namespace that describes Values used in Confidence
 * @public
 */
export namespace Value {
  // TODO should lists be able to contain Structs?
  const LIST_ITEM_TYPES = new Set(['number', 'string', 'boolean']);

  /** TypeName enum */
  export type TypeName = 'number' | 'string' | 'boolean' | 'Struct' | 'List' | 'undefined';
  // TODO add Date
  /** Primitive types */
  export type Primitive = number | string | boolean;
  /** Struct in Confidence */
  export type Struct = {
    readonly [key: string]: Value;
  };
  /** Readonly List */
  export type List = ReadonlyArray<number> | ReadonlyArray<string> | ReadonlyArray<boolean>;

  /** Asserts a Value */
  export function assertValue(value: unknown): asserts value is Value {
    switch (typeof value) {
      case 'bigint':
      case 'symbol':
      case 'function':
        throw new TypeMismatchError('number | boolean | string | Struct | List', typeof value);
      case 'object':
        if (value === null) return;
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

  /** Clones a Value */
  export function clone<T extends Value>(value: T): T {
    if (value === null) return undefined as T;
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

  /** Asserts if two Values are equal */
  export function equal(value1: Value, value2: Value): boolean {
    if (value1 === null) value1 = undefined;
    if (value2 === null) value2 = undefined;
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

  /** Returns typename of given Value */
  export function getType(value: Value): TypeName {
    if (value === null) return 'undefined';
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

  /** Asserts that Value is a Struct */
  export function isStruct(value: Value): value is Struct {
    return Value.getType(value) === 'Struct';
  }

  /** Asserts that Value is a List */
  export function isList(value: Value): value is List {
    return Value.getType(value) === 'List';
  }

  /** Asserts that type of value is undefined */
  export function assertType(expected: 'undefined', found: Value): asserts found is undefined;
  /** Asserts that type of value is string */
  export function assertType(expected: 'string', found: Value): asserts found is string;
  /** Asserts that type of value is number */
  export function assertType(expected: 'number', found: Value): asserts found is number;
  /** Asserts that type of value is boolean */
  export function assertType(expected: 'boolean', found: Value): asserts found is boolean;
  /** Asserts that type of value is List */
  export function assertType(expected: 'List', found: Value): asserts found is List;
  /** Asserts that type of value is Struct */
  export function assertType(expected: 'Struct', found: Value): asserts found is Struct;
  /** Asserts that type of value is Value */
  export function assertType(expected: TypeName, found: Value): asserts found is Value {
    const actual = Value.getType(found);
    if (expected !== actual) {
      throw new TypeMismatchError(expected, actual);
    }
  }

  /** Returns a Value given a Struct */
  export function get(struct: Struct | undefined, path: string): Value;
  /** Returns a Value given a Struct */
  export function get(struct: Struct | undefined, ...steps: string[]): Value;
  /** Returns a Value given a Struct */
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

  /** Serializes value */
  export function serialize(value: Value): string {
    const writer = new Writer();
    writer.writeValue(value);
    return writer.data;
  }

  /** Deserializes value */
  export function deserialize(data: string): Value {
    const reader = new Reader(data);
    return reader.readValue();
  }

  const enum BinaryType {
    STRING = 0,
    NUMBER,
    BOOLEAN_TRUE,
    BOOLEAN_FALSE,
    LIST,
    STRUCT,
  }
  // 8 byte buffer for encoding one float64
  const numberBuffer = new Uint16Array(4);
  class Writer {
    private readonly buffer: string[] = [];

    get data(): string {
      return this.buffer.join('');
    }

    // eslint-disable-next-line consistent-return
    writeValue(value: Value) {
      // eslint-disable-next-line default-case
      switch (getType(value)) {
        case 'string':
          return this.writeString(value as string);
        case 'number':
          return this.writeNumber(value as number);
        case 'boolean':
          return this.writeBoolean(value as boolean);
        case 'Struct':
          return this.writeStruct(value as Struct);
        case 'List':
          return this.writeList(value as List);
        case 'undefined':
          // ignore
          break;
      }
    }

    writeString(value: string) {
      this.buffer.push(String.fromCharCode(BinaryType.STRING, value.length), value);
    }

    writeNumber(value: number) {
      new DataView(numberBuffer.buffer).setFloat64(0, value);
      this.buffer.push(String.fromCharCode(BinaryType.NUMBER, ...numberBuffer));
    }

    writeBoolean(value: boolean) {
      this.buffer.push(String.fromCharCode(value ? BinaryType.BOOLEAN_TRUE : BinaryType.BOOLEAN_FALSE));
    }

    writeList(list: List) {
      this.buffer.push(String.fromCharCode(BinaryType.LIST, list.length));
      for (const value of list) {
        this.writeValue(value);
      }
    }

    writeStruct(struct: Struct) {
      const keys = Object.keys(struct).filter(key => struct[key] !== null && typeof struct[key] !== 'undefined');
      keys.sort();
      this.buffer.push(String.fromCharCode(BinaryType.STRUCT, keys.length));
      for (const key of keys) {
        // naked string
        this.buffer.push(String.fromCharCode(key.length), key);
        this.writeValue(struct[key]);
      }
    }
  }

  class Reader {
    private readonly str: string;
    private pos = 0;

    constructor(data: string) {
      this.str = data;
    }

    // eslint-disable-next-line consistent-return
    readValue(): Value {
      // eslint-disable-next-line default-case
      switch (this.str.charCodeAt(this.pos) as BinaryType) {
        case BinaryType.STRING:
          return this.readString();
        case BinaryType.NUMBER:
          return this.readNumber();
        case BinaryType.BOOLEAN_TRUE:
          this.pos++;
          return true;
        case BinaryType.BOOLEAN_FALSE:
          this.pos++;
          return false;
        case BinaryType.LIST:
          return this.readList();
        case BinaryType.STRUCT:
          return this.readStruct();
      }
    }

    readString(): string {
      this.readType(BinaryType.STRING);
      return this.readNakedString();
    }

    readNumber(): number {
      this.readType(BinaryType.NUMBER);
      for (let i = 0; i < 4; i++) {
        numberBuffer[i] = this.read();
      }
      return new DataView(numberBuffer.buffer).getFloat64(0);
    }

    readBoolean(): boolean {
      const type = this.read();
      if (type === BinaryType.BOOLEAN_TRUE) return true;
      if (type === BinaryType.BOOLEAN_FALSE) return false;
      throw new Error(
        `Expected type ${BinaryType.BOOLEAN_TRUE}|${BinaryType.BOOLEAN_FALSE} found $type} at pos ${this.pos - 1}`,
      );
    }

    readList(): List {
      this.readType(BinaryType.LIST);
      const list: Value[] = [];
      let len = this.read();
      while (--len >= 0) {
        list.push(this.readValue());
      }
      return list as List;
    }

    readStruct(): Struct {
      this.readType(BinaryType.STRUCT);
      const struct: Record<string, Value> = {};
      let len = this.read();
      while (--len >= 0) {
        const key = this.readNakedString();
        const value = this.readValue();
        struct[key] = value;
      }
      return struct;
    }

    private read(): number {
      if (this.pos >= this.str.length) throw new Error('Read past end of data');
      return this.str.charCodeAt(this.pos++);
    }
    private readType(expectedType: BinaryType) {
      const actualType = this.read();
      if (actualType !== expectedType)
        throw new Error(`Expected type ${expectedType} found ${actualType} at pos ${this.pos - 1}`);
    }
    private readNakedString(): string {
      const len = this.read();
      const start = this.pos;
      this.pos += len;
      if (this.pos > this.str.length) throw new Error('Read past end of data');
      return this.str.substring(start, this.pos);
    }
  }
}
/** Confidence used Values */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Value = Value.Primitive | Value.Struct | Value.List | undefined;
