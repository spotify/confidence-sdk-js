#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../dist/confidence-worker.js', import.meta.url));
const args = process.argv.slice(2);
const check = args[0] === '--check';
const positionalArgs = check ? args.slice(1) : args;

if (positionalArgs.length !== 1 || positionalArgs[0].startsWith('-')) {
  console.error('Usage: confidence-copy-worker [--check] <destination>');
  process.exitCode = 1;
} else {
  const destination = resolve(positionalArgs[0]);

  try {
    const worker = await readFile(workerPath);

    if (check) {
      let installedWorker;
      try {
        installedWorker = await readFile(destination);
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new Error(`Worker is missing at ${destination}`);
        }
        throw error;
      }

      if (!worker.equals(installedWorker)) {
        throw new Error(`Worker at ${destination} does not match the installed package`);
      }

      console.log(`Worker is up to date at ${destination}`);
    } else {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, worker);
      console.log(`Copied Confidence worker to ${destination}`);
    }
  } catch (error) {
    console.error(`confidence-copy-worker: ${error.message}`);
    process.exitCode = 1;
  }
}
