/** @type {import('@yarnpkg/types')} */
const { defineConfig } = require('@yarnpkg/types');

module.exports = defineConfig({
  async constraints({ Yarn }) {
    for (const workspace of Yarn.workspaces()) {
      if (!workspace.cwd.startsWith('packages/')) {
        workspace.set('private', true);
        continue;
      }
      workspace.set('type', 'module');
      workspace.set('module', 'build/esm/index.js');
      workspace.set('types', 'build/types/index.d.ts');
      workspace.set('files', ['dist/index.*']);
      workspace.set('scripts.build', 'tsc');
      workspace.set('scripts.bundle', 'api-extractor run ${CI:---local} && rollup -c');
      workspace.set('publishConfig', {
        access: 'public',
        types: 'dist/index.d.ts',
        module: 'dist/index.js',
      });
      workspace.set('devDependencies.@microsoft/api-extractor', '*');
      workspace.set('devDependencies.rollup', '*');

      // make sure all deps to this workspace use the correct version
      for (const dep of Yarn.dependencies({ ident: workspace.ident })) {
        dep.update(workspace.pkg.version);
      }
    }
  },
});
