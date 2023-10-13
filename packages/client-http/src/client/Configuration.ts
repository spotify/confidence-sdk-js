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

  export interface Flag<T = any> {
    name: string;
    reason: ResolveReason;
    variant: string;
    value: T;
    schema: FlagSchema;
  }
  export interface SubFlag<T = any> extends Flag<T> {
    path: string;

    matches<V>(this: SubFlag, value: V): this is SubFlag<V>;
  }

  function matches(this: { schema: FlagSchema }, value: any): boolean {
    const { schema } = this;
    if (value === null || schema === null) {
      return false;
    }

    if (typeof schema !== 'object') {
      return typeof value === schema;
    }

    return Object.keys(value).every(key => matches.call({ schema: schema[key] }, value[key]));
  }

  export function get(configuration: Configuration, path: string): SubFlag {
    const [name, ...steps] = path.split('.');
    let { reason, variant, value, schema } = configuration.flags[name];

    for (const step of steps) {
      if (typeof schema != 'object') throw new Error();
      schema = schema[step];
      value = value[step];
    }

    path = steps.join('.');

    return { name, path, reason, variant, value, schema, matches };
  }
}
export interface Configuration {
  flags: Readonly<{
    [name: string]: Configuration.Flag;
  }>;
  resolveToken: string;
  context: ResolveContext;
}
