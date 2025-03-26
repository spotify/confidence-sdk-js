import { createConfig } from '../../rollup.base.mjs';

export default [
  ...createConfig('build/index.js', { dts: true, banner: "'use client';" }),
  ...createConfig('build/server.js', { dts: true }),
];
