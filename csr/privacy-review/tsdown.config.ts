import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: './src/index.ts',
  format: ['esm', 'cjs'],
  platform: 'browser',
  minify: 'dce-only',
  dts: { oxc: true },
  deps: {
    alwaysBundle: ['@spotify-confidence/csr-common', '@spotify-confidence/csr-recorder'],
  },
});
