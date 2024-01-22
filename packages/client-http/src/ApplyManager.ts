import { ConfidenceClient, AppliedFlag } from './client';

export interface ApplyManagerOptions {
  timeout: number;
  maxBufferSize: number;
  client: ConfidenceClient;
}

type TokenRecord = {
  readonly pendingApply: AppliedFlag[];
  readonly seenFlags: Set<string>;
};

export class ApplyManager {
  private readonly tokenRecords: Map<string, TokenRecord> = new Map();
  private readonly timeout: number;
  private readonly maxBufferSize: number;
  private client: ConfidenceClient;
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ApplyManagerOptions) {
    this.timeout = options.timeout;
    this.maxBufferSize = options.maxBufferSize;
    this.client = options.client;
  }

  async flush(): Promise<void> {
    for (const [resolve_token, { pendingApply }] of Array.from(this.tokenRecords.entries())) {
      if (!pendingApply.length) continue;
      // remove all flags while trying
      const flagsToSend = pendingApply.splice(0, pendingApply.length);
      this.client.apply(flagsToSend, resolve_token).catch(() => {
        // re-add flags on failure
        pendingApply.push(...flagsToSend);
      });
    }
  }

  apply(resolveToken: string, flagName: string) {
    if (!resolveToken) return;

    const tokenRecord = this.getTokenRecord(resolveToken);

    if (tokenRecord.seenFlags.has(flagName)) return;

    tokenRecord.seenFlags.add(flagName);

    tokenRecord.pendingApply.push({
      flag: `flags/${flagName}`,
      applyTime: new Date().toISOString(),
    });

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }

    if (tokenRecord.pendingApply.length >= this.maxBufferSize) {
      this.flush();
    } else {
      this.flushTimeout = setTimeout(() => this.flush(), this.timeout);
    }
  }

  private getTokenRecord(resolveToken: string): TokenRecord {
    let tokenRecord = this.tokenRecords.get(resolveToken);
    if (!tokenRecord) {
      this.tokenRecords.set(resolveToken, (tokenRecord = { pendingApply: [], seenFlags: new Set() }));
    }
    return tokenRecord;
  }
}
