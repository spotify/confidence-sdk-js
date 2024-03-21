import { nodeResolve } from '@rollup/plugin-node-resolve';
import swc from '@rollup/plugin-swc';

export default {
  input: 'build/esm/index.js',
  external: /node_modules/,
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
    generatedCode: 'es2015',
  },
  plugins: [
    nodeResolve(),
    swc({
      swc: {
        jsc: {
          target: 'es2015',
        },
      },
    }),
  ],
};
