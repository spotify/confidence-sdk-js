#!/usr/bin/env node
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const src = resolve(pkgRoot, '..', 'csr-common', 'dist', 'confidence-worker.js');
const distDir = resolve(pkgRoot, 'dist');
mkdirSync(distDir, { recursive: true });
const dest = resolve(distDir, 'confidence-worker.js');
copyFileSync(src, dest);
console.log(`emit-worker-file: copied confidence-worker.js from csr-common`);
