import { Configuration, ResolveContext } from './Configuration';
import { ConfidenceFlag, ResolvedFlag } from './ConfidenceFlag';

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

export type ConfidenceClientOptions = {
  fetchImplementation: typeof fetch;
  clientSecret: string;
  apply: boolean;
  region: 'eu' | 'us';
  baseUrl?: string;
};
export type AppliedFlag = {
  flag: string;
  applyTime: string;
};

export class ConfidenceClient {
  private readonly backendApplyEnabled: boolean;
  private readonly baseUrl: string;
  private readonly clientSecret: string;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: ConfidenceClientOptions) {
    this.fetchImplementation = options.fetchImplementation;
    this.clientSecret = options.clientSecret;
    this.backendApplyEnabled = options.apply;
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
    const response = await this.fetchImplementation(`${this.baseUrl}/v1/flags:resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const responseBody: ResolveResponse = await response.json();
    return {
      flags: responseBody.resolvedFlags.reduce((acc, flag) => {
        return { ...acc, [flag.flag]: new ConfidenceFlag(flag) };
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
