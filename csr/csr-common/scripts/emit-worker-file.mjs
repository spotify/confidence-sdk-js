#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const { workerScript, WORKER_HASH } = await import(resolve(pkgRoot, 'dist/uploader/index.js'));

const standalone = `globalThis.__WORKER_HASH__ = '${WORKER_HASH}';\n${workerScript}`;
const outPath = resolve(pkgRoot, 'dist/confidence-worker.js');
writeFileSync(outPath, standalone);
console.log(`emit-worker-file: wrote ${standalone.length} bytes to ${outPath} (hash ${WORKER_HASH})`);
