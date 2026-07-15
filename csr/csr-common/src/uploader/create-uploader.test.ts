import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateUploaderOptions } from './types';

vi.mock('./worker/worker-script', () => ({
  workerScript: 'console.log("worker")',
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

describe('createUploader', () => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  describe('worker load failure (sync throw)', () => {
    it('throws with CSP hint when Worker constructor throws', async () => {
      (globalThis as Record<string, unknown>).Worker = class {
        constructor() {
          throw new DOMException('Refused to create a worker', 'SecurityError');
        }
      };
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploader();

      await expect(createUploader({ ...DEFAULTS, workerMode: 'dedicated' })).rejects.toThrow(/worker-src/);
    });

    it('throws with CSP hint when SharedWorker constructor throws', async () => {
      (globalThis as Record<string, unknown>).SharedWorker = class {
        constructor() {
          throw new DOMException('Refused to create a worker', 'SecurityError');
        }
      };

      const createUploader = await loadCreateUploader();

      await expect(createUploader({ ...DEFAULTS, workerMode: 'shared' })).rejects.toThrow(/worker-src/);
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

  describe('custom workerUrl', () => {
    it('includes the URL in the error when a custom workerUrl fails', async () => {
      (globalThis as Record<string, unknown>).Worker = class {
        constructor() {
          throw new Error('Not found');
        }
      };
      delete (globalThis as Record<string, unknown>).SharedWorker;

      const createUploader = await loadCreateUploader();

      await expect(
        createUploader({ ...DEFAULTS, workerMode: 'dedicated', workerUrl: 'https://cdn.example/worker.js' }),
      ).rejects.toThrow(/https:\/\/cdn\.example\/worker\.js/);
    });
  });
});
