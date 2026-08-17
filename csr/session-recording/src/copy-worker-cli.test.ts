import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceCli = join(packageRoot, 'bin/confidence-copy-worker.mjs');

describe('confidence-copy-worker', () => {
  let fixtureRoot: string;
  let cli: string;
  let worker: string;

  beforeEach(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'confidence-copy-worker-'));
    cli = join(fixtureRoot, 'bin/confidence-copy-worker.mjs');
    worker = join(fixtureRoot, 'dist/confidence-worker.js');
    mkdirSync(dirname(cli), { recursive: true });
    mkdirSync(dirname(worker), { recursive: true });
    cpSync(sourceCli, cli);
    writeFileSync(worker, 'self.__CONFIDENCE_WORKER__ = true;\n');
  });

  afterEach(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], {
      encoding: 'utf8',
    });

  it('copies the packaged worker and creates destination directories', () => {
    const destination = join(fixtureRoot, 'public/assets/confidence-worker.js');

    const result = run(destination);

    expect(result.status).toBe(0);
    expect(readFileSync(destination)).toEqual(readFileSync(worker));
  });

  it('passes --check when the destination is current', () => {
    const destination = join(fixtureRoot, 'public/confidence-worker.js');
    run(destination);

    const result = run('--check', destination);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Worker is up to date');
  });

  it.each([
    ['missing', undefined, 'Worker is missing'],
    ['stale', 'old worker contents', 'does not match the installed package'],
  ])('fails --check for a %s destination', (_condition, contents, expectedError) => {
    const destination = join(fixtureRoot, 'public/confidence-worker.js');
    if (contents) {
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, contents);
    }

    const result = run('--check', destination);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(expectedError);
  });
});
