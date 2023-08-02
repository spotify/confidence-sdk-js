import { Configuration } from './Configuration';

type FlagSchema =
  | 'number'
  | 'boolean'
  | 'string'
  | {
      [step: string]: FlagSchema;
    };
type ConfidenceBaseTypes = { boolSchema: {} } | { doubleSchema: {} } | { intSchema: {} } | { stringSchema: {} };
type ConfidenceFlagSchema = {
  schema: {
    [key: string]: ConfidenceBaseTypes | { structSchema: ConfidenceFlagSchema };
  };
};

function valueMatchesSchema(value: any, schema: FlagSchema): boolean {
  if (value === null) {
    return false;
  }

  if (typeof schema !== 'object') {
    return typeof value === schema;
  }

  return Object.keys(value).every(key => valueMatchesSchema(value[key], schema[key]));
}
function parseBaseType(obj: ConfidenceBaseTypes): FlagSchema {
  if ('boolSchema' in obj) {
    return 'boolean';
  }
  if ('doubleSchema' in obj) {
    return 'number';
  }
  if ('intSchema' in obj) {
    return 'number';
  }
  if ('stringSchema' in obj) {
    return 'string';
  }

  throw new Error(`Confidence: cannot parse schema. unknown schema: ${JSON.stringify(obj)}`);
}
function parseSchema(schema: ConfidenceFlagSchema | undefined): FlagSchema {
  if (!schema) {
    return {};
  }

  return Object.keys(schema.schema).reduce((acc: Record<string, FlagSchema>, key) => {
    const obj = schema.schema[key];
    if ('structSchema' in obj) {
      return {
        ...acc,
        [key]: parseSchema(obj.structSchema),
      };
    }
    return {
      ...acc,
      [key]: parseBaseType(obj),
    };
  }, {});
}

export type ResolvedFlag<T = any> = {
  flag: string;
  variant: string;
  value?: T;
  flagSchema?: ConfidenceFlagSchema;
  reason: Configuration.ResolveReason;
};

export class ConfidenceFlag implements Configuration.Flag {
  readonly flagName: string;
  readonly variant: string;
  readonly value: unknown;
  readonly schema: FlagSchema;
  readonly reason: Configuration.ResolveReason;

  constructor(flag: ResolvedFlag) {
    this.flagName = flag.flag;
    this.reason = flag.reason;
    this.variant = flag.variant;
    this.value = flag.value;
    this.schema = parseSchema(flag.flagSchema);
  }

  getValue(...path: string[]): Configuration.FlagValue | null {
    if (this.reason !== Configuration.ResolveReason.Match) {
      return {
        value: null,
        match: () => false,
      };
    }

    let value: any = this.value;
    let schema: FlagSchema = this.schema;
    for (const part of path) {
      if (typeof schema !== 'object') {
        return null;
      }
      value = value[part];
      schema = schema[part];
      if (schema === undefined) {
        return null;
      }
    }

    return {
      value,
      match: (val): boolean => valueMatchesSchema(val, schema),
    };
  }
}
