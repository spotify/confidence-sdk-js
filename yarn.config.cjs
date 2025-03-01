// /** @type {import('@yarnpkg/types')} */
// const { defineConfig } = require('@yarnpkg/types');
const defineConfig = config => config;

module.exports = defineConfig({
  async constraints({ Yarn }) {
    const root = Yarn.workspace({ cwd: '.' });
    for (const workspace of Yarn.workspaces()) {
      const depsToWorkspace = Yarn.dependencies({ ident: workspace.ident });
      if (!workspace.cwd.startsWith('packages/')) {
        // workspace is not a published package (example or root)
        // ...it should be private
        workspace.set('private', true);
        // ...there should be no dependencies to it
        for (const dep of depsToWorkspace) {
          dep.delete();
        }
        // done with this workspace
        continue;
      }
      // workspace is a published package
      // make sure all deps to this workspace use the correct version
      for (const dep of depsToWorkspace) {
        if (dep.workspace.cwd.startsWith('examples/')) {
          // example apps should always use the workspace version
          dep.update('workspace:*');
        } else if (dep.type === 'peerDependencies') {
          // peer dependencies should use a GT & LT range
          // example: ">=0.1.4 <=0.3.x" where 0.3.x is the next breaking version
          const [minVersion] = dep.range.match(/^>=\d+\.\d+\.\d+/) || [];
          if (!minVersion) {
            dep.error(`Expected peer dependency to use a min version`);
          }
          // TODO maybe automatically set the max version to the next breaking version
          // dep.workspace.set(['peerDependencies', dep.ident], `${minVersion} <=${workspace.pkg.version}`);

          // peer dependencies should also have a dev dependency to the workspace
          dep.workspace.set(['devDependencies', dep.ident], 'workspace:*');
        } else if (dep.type === 'devDependencies') {
          dep.update('workspace:*');
        } else if (dep.type === 'dependencies') {
          // there should be no regular deps between packages.
          dep.delete();
        }
      }

      // package.json invariants
      workspace.set('main', 'dist/index.cjs.js');
      workspace.set('module', 'dist/index.esm.js');
      workspace.unset('type');
      workspace.set('types', 'build/types/index.d.ts');
      workspace.set('files', ['dist/index.*']);
      workspace.set('scripts.build', 'tsc -b');
      workspace.set('scripts.bundle', 'rollup -c && api-extractor run');
      workspace.set('scripts.prepack', 'yarn build && yarn bundle');
      workspace.unset('exports');
      workspace.set('publishConfig', {
        registry: 'https://registry.npmjs.org/',
        access: 'public',
        types: 'dist/index.d.ts',
        main: 'dist/index.cjs.js',
        module: 'dist/index.esm.js',
      });
      // dev deps that should all share the same version (from root package.json)
      for (const id of ['@microsoft/api-extractor', 'rollup']) {
        workspace.set(['devDependencies', id], getRootVersion(id));
      }
    }

    function getRootVersion(id) {
      const version = root.pkg.dependencies.get(id)?.version;
      if (!version) {
        root.error(`Expected dependency on ${id}.`);
      }
      return version;
    }
  },
});
