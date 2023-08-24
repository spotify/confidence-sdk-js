import { ConfidenceFlag } from './ConfidenceFlag';

export type ResolveContext = { targeting_key?: string };

export namespace Configuration {
  export enum ResolveReason {
    Unspecified = 'RESOLVE_REASON_UNSPECIFIED',
    Match = 'RESOLVE_REASON_MATCH',
    NoSegmentMatch = 'RESOLVE_REASON_NO_SEGMENT_MATCH',
    NoTreatmentMatch = 'RESOLVE_REASON_NO_TREATMENT_MATCH',
    Archived = 'RESOLVE_REASON_FLAG_ARCHIVED',
  }
  export interface FlagValue<T = unknown> {
    readonly value: T;
    match<S>(obj: S): this is FlagValue<S>;
  }

  export namespace Flag {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    export function serialize(flag: Configuration.Flag): Configuration.Serialized['flags'][string] {
      return {
        flagName: flag.flagName,
        reason: flag.reason,
        variant: flag.variant,
        value: flag.value,
        schema: flag.schema,
      };
    }
  }
  export interface Flag {
    readonly flagName: string;
    readonly variant: string;
    readonly reason: ResolveReason;
    readonly value: unknown;
    readonly schema: any;
    getValue(...path: string[]): FlagValue | null;
  }

  export type Serialized = {
    flags: Readonly<{
      [name: string]: {
        flagName: string;
        variant: string;
        reason: ResolveReason;
        value: unknown;
        schema: any;
      };
    }>;
    resolveToken: string;
    context: ResolveContext;
  };

  export function serialize(configuration: Configuration): Serialized {
    return {
      flags: Object.keys(configuration.flags).reduce((acc: any, flagKey: string) => {
        return {
          ...acc,
          [flagKey]: Configuration.Flag.serialize(configuration.flags[flagKey]),
        };
      }, {}),
      context: configuration.context,
      resolveToken: configuration.resolveToken,
    };
  }

  export function toConfiguration(serialized: Configuration.Serialized): Configuration {
    return {
      flags: Object.keys(serialized.flags).reduce((acc, flagKey) => {
        // @ts-ignore
        return { ...acc, [flagKey]: new ConfidenceFlag(serialized.flags[flagKey]) };
      }, {}),
      resolveToken: serialized.resolveToken,
      context: serialized.context,
    };
  }
}

export interface Configuration {
  flags: Readonly<{
    [name: string]: Configuration.Flag;
  }>;
  resolveToken: string;
  context: ResolveContext;
}
