import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateUploaderOptions } from './types';

vi.mock('./worker/worker-script', () => ({
  workerScript: 'console.log("worker")',
}));
vi.mock('./worker-hash', () => ({
  WORKER_HASH: 'expected-hash',
}));

const DEFAULTS: CreateUploaderOptions = {
  apiUrl: 'https://api.example',
  clientSecret: 'secret',
};

function fakeSessionStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => Object.keys(store).forEach(k => delete store[k]),
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

class StubWorker {
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage() {}
}

function installWorkerStubs(opts?: { workerThrows?: boolean; sharedWorkerThrows?: boolean }) {
  (globalThis as Record<string, unknown>).Worker = opts?.workerThrows
    ? class {
        constructor() {
          throw new DOMException('Blocked', 'SecurityError');
        }
      }
    : StubWorker;

  if (opts?.sharedWorkerThrows) {
    (globalThis as Record<string, unknown>).SharedWorker = class {
      constructor() {
        throw new DOMException('Blocked', 'SecurityError');
      }
    };
  } else {
    (globalThis as Record<string, unknown>).SharedWorker = class {
      onerror: ((e: Event) => void) | null = null;
      port = {
        start() {},
        onmessage: null as ((e: MessageEvent) => void) | null,
        postMessage() {},
      };
    };
  }
}

function tick() {
  return new Promise(r => setTimeout(r, 0));
}

describe('createUploader', () => {
  const blobUrls: string[] = [];

  beforeEach(() => {
    globalThis.sessionStorage = fakeSessionStorage();

    if (!globalThis.crypto) {
      (globalThis as Record<string, unknown>).crypto = {};
    }
    if (!globalThis.crypto.randomUUID) {
      globalThis.crypto.randomUUID = () =>
        '00000000-0000-0000-0000-000000000000' as `${string}-${string}-${string}-${string}-${string}`;
    }
    if (!globalThis.crypto.subtle?.digest) {
      (globalThis.crypto as Record<string, unknown>).subtle = {
        digest: async () => new ArrayBuffer(32),
      };
    }

    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:http://localhost/${blobUrls.length}`;
      blobUrls.push(url);
      return url;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    blobUrls.length = 0;
    delete (globalThis as Record<string, unknown>).SharedWorker;
  });

  async function loadCreateUploader() {
    vi.resetModules();
    // .js extension is required by Node16 module resolution for dynamic imports
    // (static `import` lines work without it because the package is CJS — see package.json).
    // eslint-disable-next-line es/no-dynamic-import
    const mod = await import('./create-uploader.js');
    return mod.createUploader;
  }

  describe('blob: fallback', () => {
    it('uses data: URL when Worker constructor succeeds', async () => {
      installWorkerStubs();

      const createUploader = await loadCreateUploader();
      const logs: string[] = [];
      createUploader({ ...DEFAULTS, workerMode: 'dedicated', debugLogger: m => logs.push(m) });
      await tick();

      expect(blobUrls).toHaveLength(0);
      expect(logs.some(l => l.includes('via data'))).toBe(true);
    });

    it('falls back to blob: when data: Worker throws', async () => {
      let constructedUrl: string | undefined;
      (globalThis as Record<string, unknown>).Worker = class {
        onerror: ((e: Event) => void) | null = null;
        onmessage: ((e: MessageEvent) => void) | null = null;
        postMessage() {}
        constructor(url: string) {
          if (url.startsWith('data:')) {
            throw new DOMException('Blocked', 'SecurityError');
          }
          constructedUrl = url;
        }
      };
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploader();
      const logs: string[] = [];
      createUploader({ ...DEFAULTS, workerMode: 'dedicated', debugLogger: m => logs.push(m) });
      await tick();

      expect(blobUrls).toHaveLength(1);
      expect(constructedUrl).toBe(blobUrls[0]);
      expect(logs.some(l => l.includes('falling back to blob:'))).toBe(true);
      expect(logs.some(l => l.includes('via blob'))).toBe(true);
    });

    it('falls back to blob: dedicated worker when SharedWorker data: throws', async () => {
      (globalThis as Record<string, unknown>).SharedWorker = class {
        constructor() {
          throw new DOMException('Blocked', 'SecurityError');
        }
      };
      let constructedUrl: string | undefined;
      (globalThis as Record<string, unknown>).Worker = class {
        onerror: ((e: Event) => void) | null = null;
        onmessage: ((e: MessageEvent) => void) | null = null;
        postMessage() {}
        constructor(url: string) {
          constructedUrl = url;
        }
      };

      const createUploader = await loadCreateUploader();
      const logs: string[] = [];
      createUploader({ ...DEFAULTS, workerMode: 'shared', debugLogger: m => logs.push(m) });
      await tick();

      expect(blobUrls).toHaveLength(1);
      expect(constructedUrl).toBe(blobUrls[0]);
      expect(logs.some(l => l.includes('falling back to blob:'))).toBe(true);
    });

    it('falls back to blob: when SharedWorker onerror fires asynchronously (Chrome CSP)', async () => {
      let constructedUrl: string | undefined;
      (globalThis as Record<string, unknown>).SharedWorker = class {
        onerror: ((e: Event) => void) | null = null;
        port = {
          start() {},
          onmessage: null as ((e: MessageEvent) => void) | null,
          postMessage() {},
        };
        constructor() {
          setTimeout(() => this.onerror?.(new Event('error')), 0);
        }
      };
      (globalThis as Record<string, unknown>).Worker = class {
        onerror: ((e: Event) => void) | null = null;
        onmessage: ((e: MessageEvent) => void) | null = null;
        postMessage() {}
        constructor(url: string) {
          constructedUrl = url;
        }
      };

      const createUploader = await loadCreateUploader();
      const logs: string[] = [];
      // Await the full async chain: openWorkerPort detects the async onerror,
      // falls back to blob, then createUploader eventually hits the welcome timeout.
      const p = createUploader({
        ...DEFAULTS,
        workerMode: 'shared',
        debugLogger: m => logs.push(m),
        _welcomeTimeoutMs: 50,
      });
      await expect(p).rejects.toThrow(/welcome timeout/);

      expect(blobUrls).toHaveLength(1);
      expect(constructedUrl).toBe(blobUrls[0]);
      expect(logs.some(l => l.includes('falling back to blob:'))).toBe(true);
    });

    it('throws with CSP hint when both data: and blob: are blocked', async () => {
      (globalThis as Record<string, unknown>).Worker = class {
        constructor() {
          throw new DOMException('Blocked', 'SecurityError');
        }
      };
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploader();

      await expect(createUploader({ ...DEFAULTS, workerMode: 'dedicated' })).rejects.toThrow(/worker-src/);
    });

    it('logs CSP hint via debugLogger when both data: and blob: are blocked', async () => {
      (globalThis as Record<string, unknown>).Worker = class {
        constructor() {
          throw new DOMException('Blocked', 'SecurityError');
        }
      };
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploader();
      const logs: string[] = [];

      await expect(
        createUploader({ ...DEFAULTS, workerMode: 'dedicated', debugLogger: m => logs.push(m) }),
      ).rejects.toThrow();
      expect(logs.some(l => l.includes('worker-load-failed') && l.includes('worker-src'))).toBe(true);
    });

    it('does not fall back when a custom workerUrl is provided', async () => {
      (globalThis as Record<string, unknown>).Worker = class {
        constructor() {
          throw new Error('custom URL not found');
        }
      };
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploader();

      await expect(
        createUploader({ ...DEFAULTS, workerMode: 'dedicated', workerUrl: 'https://cdn.example/worker.js' }),
      ).rejects.toThrow();
      expect(blobUrls).toHaveLength(0);
    });
  });

  describe('worker load failure (async error)', () => {
    it('throws with CSP hint when dedicated Worker fires onerror', async () => {
      (globalThis as Record<string, unknown>).Worker = class {
        onerror: ((e: Event) => void) | null = null;
        onmessage: ((e: MessageEvent) => void) | null = null;
        postMessage() {}
        constructor() {
          setTimeout(() => this.onerror?.(new Event('error')), 5);
        }
      };
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploader();

      await expect(createUploader({ ...DEFAULTS, workerMode: 'dedicated' })).rejects.toThrow(/worker-src/);
    });

    it('throws with CSP hint when SharedWorker fires onerror', async () => {
      (globalThis as Record<string, unknown>).SharedWorker = class {
        onerror: ((e: Event) => void) | null = null;
        port = {
          start() {},
          onmessage: null as ((e: MessageEvent) => void) | null,
          postMessage() {},
        };
        constructor() {
          setTimeout(() => this.onerror?.(new Event('error')), 5);
        }
      };

      const createUploader = await loadCreateUploader();

      await expect(createUploader({ ...DEFAULTS, workerMode: 'shared' })).rejects.toThrow(/worker-src/);
    });
  });

  describe('worker hash mismatch', () => {
    beforeEach(() => {
      (globalThis as Record<string, unknown>).window = { addEventListener: vi.fn() };
      (globalThis as Record<string, unknown>).document = { addEventListener: vi.fn() };
    });

    afterEach(() => {
      delete (globalThis as Record<string, unknown>).window;
      delete (globalThis as Record<string, unknown>).document;
    });

    function workerThatReplies(welcomeOverrides: Record<string, unknown> = {}) {
      return class {
        onerror: ((e: Event) => void) | null = null;
        onmessage: ((e: MessageEvent) => void) | null = null;
        postMessage(m: unknown) {
          const msg = m as { type: string };
          if (msg.type === 'hello') {
            setTimeout(
              () =>
                this.onmessage?.({
                  data: {
                    type: 'welcome',
                    result: { sessionId: 'sess-1', sessionToken: 'tok-1' },
                    workerHash: 'stale-hash',
                    ...welcomeOverrides,
                  },
                } as MessageEvent),
              0,
            );
          }
        }
      };
    }

    async function loadCreateUploaderWithMockedContext() {
      vi.doMock('./client-context', () => ({ collectUserAgentContext: () => null }));
      return loadCreateUploader();
    }

    it('logs a warning when workerUrl is set and hashes mismatch', async () => {
      (globalThis as Record<string, unknown>).Worker = workerThatReplies();
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploaderWithMockedContext();
      const logs: string[] = [];
      await createUploader({
        ...DEFAULTS,
        workerMode: 'dedicated',
        workerUrl: '/confidence-worker.js',
        debugLogger: m => logs.push(m),
      });

      expect(logs.some(l => l.includes('WORKER MISMATCH'))).toBe(true);
    });

    it('does not warn when using data: URL (inlined worker)', async () => {
      (globalThis as Record<string, unknown>).Worker = workerThatReplies();
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploaderWithMockedContext();
      const logs: string[] = [];
      await createUploader({
        ...DEFAULTS,
        workerMode: 'dedicated',
        debugLogger: m => logs.push(m),
      });

      expect(logs.some(l => l.includes('WORKER MISMATCH'))).toBe(false);
    });

    it('does not warn when hashes match', async () => {
      (globalThis as Record<string, unknown>).Worker = workerThatReplies({ workerHash: 'expected-hash' });
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploaderWithMockedContext();
      const logs: string[] = [];
      await createUploader({
        ...DEFAULTS,
        workerMode: 'dedicated',
        workerUrl: '/confidence-worker.js',
        debugLogger: m => logs.push(m),
      });

      expect(logs.some(l => l.includes('WORKER MISMATCH'))).toBe(false);
    });

    it('does not warn when workerHash is absent (old worker)', async () => {
      (globalThis as Record<string, unknown>).Worker = workerThatReplies({ workerHash: undefined });
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploaderWithMockedContext();
      const logs: string[] = [];
      await createUploader({
        ...DEFAULTS,
        workerMode: 'dedicated',
        workerUrl: '/confidence-worker.js',
        debugLogger: m => logs.push(m),
      });

      expect(logs.some(l => l.includes('WORKER MISMATCH'))).toBe(false);
    });
  });

  describe('welcome timeout', () => {
    it('rejects when the worker never sends a welcome', async () => {
      (globalThis as Record<string, unknown>).Worker = class {
        onerror: ((e: Event) => void) | null = null;
        onmessage: ((e: MessageEvent) => void) | null = null;
        postMessage() {}
      };
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploader();

      await expect(createUploader({ ...DEFAULTS, workerMode: 'dedicated', _welcomeTimeoutMs: 50 })).rejects.toThrow(
        /welcome timeout/,
      );
    });
  });
});
