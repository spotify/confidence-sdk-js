const glob = require('glob');
const fs = require('fs');

// load all package jsons from example dir
const exampleAppPackageJsons = glob.sync('examples/*/package.json');

// load versions of confidence packages from .release-please-manifest.json
const releasePleaseManifestJSON = JSON.parse(fs.readFileSync('.release-please-manifest.json', 'utf-8'));

// For each package in the release please manifest, find that package in the deps of all the examples and update
console.log('Checking for required updates to example app dependencies...');
for (const dep of Object.keys(releasePleaseManifestJSON)) {
  for (const packageJsonPath of exampleAppPackageJsons) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const [_, depName] = dep.split('/');

    const currentPackageVersion = packageJson.dependencies[`@spotify-confidence/${depName}`];

    if (!currentPackageVersion) {
      continue;
    }

    if (currentPackageVersion === releasePleaseManifestJSON[dep]) {
      console.log('No update needed for: @spotify-confidence/%s in %s', depName, packageJson.name);
      continue;
    }

    packageJson.dependencies[`@spotify-confidence/${depName}`] = releasePleaseManifestJSON[dep];
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
    console.log(
      'Updated @spotify-confidence/%s in %s. %s -> %s',
      depName,
      packageJson.name,
      currentPackageVersion,
      releasePleaseManifestJSON[dep],
    );
  }
}
console.log('Done updating example apps.');
