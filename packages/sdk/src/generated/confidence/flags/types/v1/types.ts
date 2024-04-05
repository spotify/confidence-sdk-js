/* eslint-disable */

export const protobufPackage = 'confidence.flags.types.v1';

/**
 * Schema for the value of a flag.
 *
 * The value of a flag is always a struct with one or more nested fields.
 * Example of a struct schema with two fields, `color` (a string) and `len` (an int):
 *
 * ```
 * {
 *   "schema": {
 *     "color": {
 *       "stringSchema": {}
 *     },
 *     "len": {
 *       "intSchema": {}
 *     }
 *   }
 * }
 * ```
 */
export interface FlagSchema {
  /** Schema if this is a struct */
  structSchema?: FlagSchema_StructFlagSchema | undefined;
  /** Schema if this is a list */
  listSchema?: FlagSchema_ListFlagSchema | undefined;
  /** Schema if this is an int */
  intSchema?: FlagSchema_IntFlagSchema | undefined;
  /** Schema if this is a double */
  doubleSchema?: FlagSchema_DoubleFlagSchema | undefined;
  /** Schema if this is a string */
  stringSchema?: FlagSchema_StringFlagSchema | undefined;
  /** Schema if this is a bool */
  boolSchema?: FlagSchema_BoolFlagSchema | undefined;
}

/**
 * A schema of nested fields. The length of the field name is limited to
 * 32 characters and can only contain alphanumeric characters, hyphens and
 * underscores. The number of fields in a struct is limited to 64.
 * Structs can not be nested more than four (4) levels.
 */
export interface FlagSchema_StructFlagSchema {
  /** Map of field name to the schema for the field */
  schema: { [key: string]: FlagSchema };
}

export interface FlagSchema_StructFlagSchema_SchemaEntry {
  key: string;
  value: FlagSchema | undefined;
}

/** A number that has a decimal place. */
export interface FlagSchema_DoubleFlagSchema {}

/** A whole number without a decimal point. */
export interface FlagSchema_IntFlagSchema {}

/** A string. The length is limited to 250 characters. */
export interface FlagSchema_StringFlagSchema {}

/** A boolean: true or false. */
export interface FlagSchema_BoolFlagSchema {}

/**
 * A list of values. The values have the same data types which
 * is defined by  `element_schema`.
 */
export interface FlagSchema_ListFlagSchema {
  /** The schema for the elements in the list */
  elementSchema: FlagSchema | undefined;
}
