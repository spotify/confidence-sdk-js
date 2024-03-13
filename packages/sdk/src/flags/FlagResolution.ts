export type ResolveContext = { targeting_key?: string };

export namespace FlagResolution {
  export enum ResolveReason {
    Unspecified = 'RESOLVE_REASON_UNSPECIFIED',
    Match = 'RESOLVE_REASON_MATCH',
    NoSegmentMatch = 'RESOLVE_REASON_NO_SEGMENT_MATCH',
    NoTreatmentMatch = 'RESOLVE_REASON_NO_TREATMENT_MATCH',
    Archived = 'RESOLVE_REASON_FLAG_ARCHIVED',
  }

  export type FlagSchema =
    | 'undefined'
    | 'number'
    | 'boolean'
    | 'string'
    | {
        [step: string]: FlagSchema;
      };

  export interface FlagValue<T = unknown> {
    value: T;
    schema: FlagSchema;
  }
  export interface Flag<T = unknown> extends FlagValue<T> {
    name: string;
    reason: ResolveReason;
    variant: string;
    value: T;
    schema: FlagSchema;
  }

  export namespace FlagValue {
    export function matches<T>({ schema }: FlagValue<T>, value: any): value is T {
      return valueMatchesSchema(value, schema);
    }

    export type Traversed<T, S extends string> = S extends `${infer STEP}.${infer REST}`
      ? STEP extends keyof T
        ? Traversed<T[STEP], REST>
        : unknown
      : S extends keyof T
      ? T[S]
      : never;

    export function traverse<T, S extends string>(flag: FlagValue<T>, path: S): FlagValue<Traversed<T, S>> {
      let value: any = flag.value;
      let schema: FlagSchema = flag.schema;

      if (path === '') {
        return { value, schema };
      }

      for (const part of path.split('.')) {
        if (typeof schema !== 'object') {
          throw new Error(`Parse Error. Cannot find path: ${path}. In flag: ${JSON.stringify(flag)}`);
        }
        value = value[part];
        schema = schema[part];
        if (schema === undefined) {
          throw new Error(`Parse Error. Cannot find path: ${path}. In flag: ${JSON.stringify(flag)}`);
        }
      }

      return { value, schema };
    }
  }
}

function valueMatchesSchema(value: any, schema: FlagResolution.FlagSchema): boolean {
  if (value === null || schema === null) {
    return false;
  }

  if (typeof schema !== 'object') {
    return typeof value === schema;
  }

  return Object.keys(value).every(key => valueMatchesSchema(value[key], schema[key]));
}

export interface FlagResolution {
  flags: Readonly<{
    [name: string]: FlagResolution.Flag;
  }>;
  resolveToken: string;
  context: ResolveContext;
}
