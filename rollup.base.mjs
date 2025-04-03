import { nodeResolve } from '@rollup/plugin-node-resolve';
import { dts } from 'rollup-plugin-dts';
import commonjs from '@rollup/plugin-commonjs';
import swc from '@rollup/plugin-swc';
import { readFileSync } from 'node:fs';
import { basename, dirname, format, parse, relative, resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const cwd = process.cwd();
const deps = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})]);

export default createConfig('build/index.js', { dts: true });

export function createConfig(input, { banner, external = [], dts } = {}) {
  const bundles = [bundleJs(input, { banner, external })];
  if (dts) {
    if (typeof dts === 'boolean') {
      dts = format({ ...parse(input), base: undefined, ext: '.d.ts' });
      // console.log('dts:', dts);
    }
    bundles.push(bundleDts(dts));
  }
  return bundles;
}

export function bundleDts(input) {
  const dir = dirname(input) + '/';
  const name = basename(input, '.d.ts');
  return {
    input,
    external: createExternalTest(dir),
    output: [
      {
        file: `dist/${name}.d.ts`,
      },
    ],
    plugins: [dts({ respectExternal: true })],
  };
}
export function bundleJs(input, { banner, external = [] } = {}) {
  const dir = dirname(input) + '/';
  const name = basename(input, '.js');
  return {
    input,
    external: createExternalTest(dir, external),
    output: [
      {
        file: `dist/${name}.mjs`,
        banner,
        format: 'es',
        sourcemap: true,
        generatedCode: 'es2015',
      },
      {
        file: `dist/${name}.cjs`,
        banner,
        format: 'cjs',
        sourcemap: true,
        generatedCode: 'es2015',
      },
    ],
    plugins: [
      nodeResolve(),
      commonjs(),
      swc({
        swc: {
          jsc: {
            target: 'es2018',
          },
        },
      }),
    ],
  };
}

function createExternalTest(prefix, external = []) {
  return (id, parent) => {
    // this function decides if a module should be bundled or not (external)
    // a module is not bundled if it points to one of our dependencies
    // if it's not a dependency but still resolves outside the build/esm dir, an error is thrown
    const path = normalizePath(id, parent);
    const depId = npmPackage(id);
    if (deps.has(depId)) {
      console.log('exclude:', path);
      return true;
    }
    if (path.startsWith(pkg.name)) {
      console.log('exclude:', path);
      return true;
    }
    if (!path.startsWith(prefix)) {
      // this will throw if we accidentally import something that isn't local and wasn't listed among dependencies
      throw new Error(`Attempt to bundle external dependency ${path} for import ${id}. Are we missing a dependency?`);
    }
    if (external.includes(path.slice(prefix.length))) {
      console.log('exclude:', path);
      return true;
    }
    // console.log('include:', path);
    return false;
  };
}

/**
 * Return the path relative to cwd for a give import. Npm package imports will be returned as if they were directly in cwd.
 *
 * @param id the imported path
 * @param parent absolute path of the file containing the import, or undefined if it's the entry point
 * @returns path relative to cwd
 */
function normalizePath(id, parent = '') {
  const absolute = id.startsWith('.') ? resolve(parent, id) : id;
  return relative(cwd, absolute);
}

/**
 * Return the npm package name of an import, if applicable.
 *
 * @param id an import path
 * @returns the npm package name if id is determined to point to an npm package, '' otherwise.
 */
function npmPackage(id) {
  // relative or absolute ids are not npm packages
  if (id.startsWith('.') || id.startsWith('/')) return '';
  // we're only ever interested in the first two parts the id (the second is needed if the first part specifies a scope)
  const parts = id.split('/', 2);
  if (parts[0].startsWith('@')) {
    // it's a scoped package, so it will include one backslash
    return parts.join('/');
  }
  return parts[0];
}
