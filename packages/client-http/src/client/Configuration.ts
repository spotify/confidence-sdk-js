export type ResolveContext = { targeting_key?: string };

export namespace Configuration {
  export enum ResolveReason {
    Unspecified = 'RESOLVE_REASON_UNSPECIFIED',
    Match = 'RESOLVE_REASON_MATCH',
    NoSegmentMatch = 'RESOLVE_REASON_NO_SEGMENT_MATCH',
    NoTreatmentMatch = 'RESOLVE_REASON_NO_TREATMENT_MATCH',
    Archived = 'RESOLVE_REASON_FLAG_ARCHIVED',
  }

  export type FlagSchema =
    | 'number'
    | 'boolean'
    | 'string'
    | {
        [step: string]: FlagSchema;
      };

  export interface Flag<T = unknown> {
    flagName: string;
    reason: ResolveReason;
    variant: string;
    value: T;
    schema: FlagSchema;
  }

  export namespace Flag {
    export function valueMatchesSchema(value: any, schema: FlagSchema | null): boolean {
      if (value === null || schema === null) {
        return false;
      }

      if (typeof schema !== 'object') {
        return typeof value === schema;
      }

      return Object.keys(value).every(key => valueMatchesSchema(value[key], schema[key]));
    }
    export function getValueAndSchema<T>(flag: Flag<T>, ...path: string[]): { value: T; schema: FlagSchema } {
      let value: any = flag.value;
      let schema: FlagSchema = flag.schema;

      for (const part of path) {
        if (typeof schema !== 'object') {
          throw new Error(`Parse Error. Cannot find path: ${path.join(',')}. In flag: ${JSON.stringify(flag)}`);
        }
        value = value[part];
        schema = schema[part];
        if (schema === undefined) {
          throw new Error(`Parse Error. Cannot find path: ${path.join(',')}. In flag: ${JSON.stringify(flag)}`);
        }
      }

      return { value, schema };
    }
  }
}

export interface Configuration {
  flags: Readonly<{
    [name: string]: Configuration.Flag;
  }>;
  resolveToken: string;
  context: ResolveContext;
}
