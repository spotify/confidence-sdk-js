#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
const target = join(dir, 'src', 'version.ts');
writeFileSync(target, `export const SDK_VERSION = '${version}';\n`);
console.log(`sync-version: ${version}`);
