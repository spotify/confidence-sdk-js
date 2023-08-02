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

  export interface Flag {
    readonly flagName: string;
    readonly variant: string;
    readonly reason: ResolveReason;
    getValue(...path: string[]): FlagValue | null;
  }
}
export interface Configuration {
  flags: Readonly<{
    [name: string]: Configuration.Flag;
  }>;
  resolveToken: string;
  context: ResolveContext;
}
