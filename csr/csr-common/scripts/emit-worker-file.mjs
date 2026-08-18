#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const { workerScript } = await import(resolve(pkgRoot, 'dist/uploader/index.js'));

const outPath = resolve(pkgRoot, 'dist/confidence-worker.js');
writeFileSync(outPath, workerScript);
console.log(`emit-worker-file: wrote ${workerScript.length} bytes to ${outPath}`);
