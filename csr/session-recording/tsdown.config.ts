import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    worker: './src/worker.ts',
    // Local-only review tooling: a separate entry so it never reaches `index` bundles.
    'privacy-review': './src/privacy-review/index.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'browser',
  minify: 'dce-only',
  dts: { oxc: true },
  deps: {
    alwaysBundle: [
      '@spotify-confidence/csr-common',
      '@spotify-confidence/csr-common/uploader',
      '@spotify-confidence/csr-recorder',
    ],
  },
});
