import { Configuration, ResolveContext } from './Configuration';

type ApplyRequest = {
  clientSecret: string;
  resolve_token: string;
  flags: AppliedFlag[];
  sendTime: string;
};
type ResolveRequest = {
  clientSecret: string;
  evaluationContext: ResolveContext;
  apply?: boolean;
  flags?: string[];
};
type ResolveResponse = {
  resolvedFlags: ResolvedFlag[];
  resolveToken: string;
};
type ConfidenceSimpleTypes = { boolSchema: {} } | { doubleSchema: {} } | { intSchema: {} } | { stringSchema: {} };
type ConfidenceFlagSchema = {
  schema: {
    [key: string]: ConfidenceSimpleTypes | { structSchema: ConfidenceFlagSchema };
  };
};

export type ResolvedFlag<T = any> = {
  flag: string;
  variant: string;
  value?: T;
  flagSchema?: ConfidenceFlagSchema;
  reason: Configuration.ResolveReason;
};
export type ConfidenceClientOptions = {
  fetchImplementation: typeof fetch;
  clientSecret: string;
  apply: boolean;
  region: 'eu' | 'us';
  baseUrl?: string;
  timeout: number;
};
export type AppliedFlag = {
  flag: string;
  applyTime: string;
};

export class ConfidenceClient {
  private readonly backendApplyEnabled: boolean;
  private readonly baseUrl: string;
  private readonly clientSecret: string;
  private readonly timeout: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: ConfidenceClientOptions) {
    this.fetchImplementation = options.fetchImplementation;
    this.clientSecret = options.clientSecret;
    this.backendApplyEnabled = options.apply;
    this.timeout = options.timeout;
    if (options.baseUrl) {
      this.baseUrl = options.baseUrl;
    } else {
      this.baseUrl = `https://resolver.${options.region}.confidence.dev`;
    }
  }
  async resolve(context: ResolveContext, options?: { apply?: boolean; flags: string[] }): Promise<Configuration> {
    const payload: ResolveRequest = {
      clientSecret: this.clientSecret,
      evaluationContext: context,
      apply: this.backendApplyEnabled,
      ...options,
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const response = await this.fetchImplementation(`${this.baseUrl}/v1/flags:resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const responseBody: ResolveResponse = await response.json();

    return {
      flags: responseBody.resolvedFlags
        .filter(({ flag }) => flag.startsWith('flags/'))
        .map(({ flag, ...rest }) => ({ flag: flag.slice('flags/'.length), ...rest }))
        .reduce((acc, flag) => {
          return { ...acc, [flag.flag]: resolvedFlagToFlag(flag) };
        }, {}),
      resolveToken: responseBody.resolveToken,
      context,
    };
  }

  async apply(flags: AppliedFlag[], resolveToken: string): Promise<void> {
    const payload: ApplyRequest = {
      clientSecret: this.clientSecret,
      resolve_token: resolveToken,
      flags,
      sendTime: new Date().toISOString(),
    };
    await this.fetchImplementation(`${this.baseUrl}/v1/flags:apply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

function resolvedFlagToFlag(flag: ResolvedFlag): Configuration.Flag {
  return {
    name: flag.flag.replace(/$flag\//, ''),
    reason: flag.reason,
    variant: flag.variant,
    value: flag.value,
    schema: parseSchema(flag.flagSchema),
  };
}

function parseBaseType(obj: ConfidenceSimpleTypes): Configuration.FlagSchema {
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

function parseSchema(schema: ConfidenceFlagSchema | undefined): Configuration.FlagSchema {
  if (!schema) {
    return {};
  }

  return Object.keys(schema.schema).reduce((acc: Record<string, Configuration.FlagSchema>, key) => {
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
