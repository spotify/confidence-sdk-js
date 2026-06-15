import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: './src/index.ts',
  format: ['esm', 'cjs'],
  platform: 'neutral',
  minify: 'dce-only',
  dts: { oxc: true },
  deps: {
    neverBundle: ['@spotify-confidence/csr-common'],
    alwaysBundle: ['rrweb', '@rrweb/rrweb-plugin-console-record'],
  },
});
