import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'uploader/index': './src/uploader/index.ts',
  },
  format: ['esm', 'cjs'],
  platform: 'neutral',
  minify: 'dce-only',
  dts: { oxc: true },
  deps: {
    neverBundle: ['bowser'],
  },
});
