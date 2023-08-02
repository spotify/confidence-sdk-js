import { ConfidenceClient, AppliedFlag } from './client';

export interface ApplyManagerOptions {
  timeout: number;
  client: ConfidenceClient;
}

export class ApplyManager {
  private resolveTokenPending: Map<string, AppliedFlag[]> = new Map();
  private resolveTokenSeen: Map<string, Set<string>> = new Map();
  private readonly timeout: number;
  private client: ConfidenceClient;
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ApplyManagerOptions) {
    this.timeout = options.timeout;
    this.client = options.client;
  }

  async flush(): Promise<void> {
    for (const resolve_token of Array.from(this.resolveTokenPending.keys())) {
      const flagsToSend = this.resolveTokenPending.get(resolve_token) || [];

      if (flagsToSend.length === 0) {
        continue;
      }

      try {
        this.client.apply(flagsToSend, resolve_token).then(() => {
          this.resolveTokenPending.set(resolve_token, []);
        });
      } catch (e: unknown) {
        // TODO log errors
      }
    }
  }

  apply(resolveToken: string, flagName: string) {
    if (!resolveToken) {
      return;
    }
    const confidenceFlagName = `flags/${flagName}`;

    if (this.resolveTokenSeen.get(resolveToken)?.has(flagName)) {
      return;
    }

    const appliedFlag: AppliedFlag = {
      flag: confidenceFlagName,
      applyTime: new Date().toISOString(),
    };

    if (!this.resolveTokenPending.has(resolveToken)) {
      this.resolveTokenPending.set(resolveToken, [appliedFlag]);
      this.resolveTokenSeen.set(resolveToken, new Set([flagName]));
    } else {
      this.resolveTokenPending.get(resolveToken)?.push(appliedFlag);
      this.resolveTokenSeen.get(resolveToken)?.add(confidenceFlagName);
    }

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    this.flushTimeout = setTimeout(() => this.flush(), this.timeout);
  }
}
