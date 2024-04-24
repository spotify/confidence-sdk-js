# Changelog

### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spotify-confidence/openfeature-web-provider bumped from ^0.1.1 to ^0.1.2

### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spotify-confidence/openfeature-web-provider bumped from ^0.1.3 to ^0.1.4

### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spotify-confidence/openfeature-web-provider bumped from ^0.1.4 to ^0.1.5

### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spotify-confidence/openfeature-web-provider bumped from ^0.2.0-rc.0 to ^0.2.1-rc.0

## [0.2.0-rc.0](https://github.com/spotify/confidence-openfeature-provider-js/compare/integration-react-v0.1.5...integration-react-v0.2.0-rc.0) (2024-04-04)


### ⚠ BREAKING CHANGES

* Since our peer dependency to `@openfeature/js-sdk` changed into `@openfeature/server-sdk`, users need to install the new package which is concidered a breaking change.

### ✨ New Features

* make provider fetchImplementation optional ([cd242a6](https://github.com/spotify/confidence-openfeature-provider-js/commit/cd242a60804d5565f69d12ec0d35acf8d980f11e))


### 🧹 Chore

* upgrade OpenFeature dependencies ([8f27a92](https://github.com/spotify/confidence-openfeature-provider-js/commit/8f27a924aa5eb7662fdf73be6564eb2e3580b2fc))


### 🔄 Refactoring

* providers depend on total confidence ([ac4a56b](https://github.com/spotify/confidence-openfeature-provider-js/commit/ac4a56be0e858cdccacd7fef248ebfec3a2e5dc0))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spotify-confidence/openfeature-web-provider bumped from ^0.1.5 to ^0.2.0-rc.0

## [0.1.3](https://github.com/spotify/confidence-openfeature-provider-js/compare/integration-react-v0.1.2...integration-react-v0.1.3) (2024-01-05)


### 📚 Documentation

* **react:** add note on setting provider before setting context ([e785c22](https://github.com/spotify/confidence-openfeature-provider-js/commit/e785c2283913f1f4a9e3875d1638c4961f9a9a5b))
* **react:** add timeout to docs ([952b7b6](https://github.com/spotify/confidence-openfeature-provider-js/commit/952b7b6c6e067c1191dd2bc492fce16a76391b6b))


### 🔄 Refactoring

* **examples:** use the default region in an example (node) ([0bc03e7](https://github.com/spotify/confidence-openfeature-provider-js/commit/0bc03e79c36a6c72dcfc46f3ad1de069474fed53))
* **react:** use global url in e2e tests ([9dbe2be](https://github.com/spotify/confidence-openfeature-provider-js/commit/9dbe2be3493025916e5596842be6b9a645edcc60))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spotify-confidence/openfeature-web-provider bumped from ^0.1.2 to ^0.1.3

## [0.1.1](https://github.com/spotify/confidence-openfeature-provider-js/compare/integration-react-v0.1.0...integration-react-v0.1.1) (2023-11-16)


### 🐛 Bug Fixes

* set correct internal dependencies ([9db8544](https://github.com/spotify/confidence-openfeature-provider-js/commit/9db8544d35410715005f2db82750c87484387c40))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spotify-confidence/openfeature-web-provider bumped from ^0.1.0 to ^0.1.1

## [0.1.0](https://github.com/spotify/confidence-openfeature-provider-js/compare/integration-react-v0.0.6...integration-react-v0.1.0) (2023-11-15)


### ⚠ BREAKING CHANGES

* **client-http,web,server,react,examples:** new required option: timeout

### ✨ New Features

* **client-http,web,server,react,examples:** add timeout for network request ([f460b97](https://github.com/spotify/confidence-openfeature-provider-js/commit/f460b97ec4e1c56375de52fd1eb664c7b9be1f35))

## [0.0.6](https://github.com/spotify/confidence-openfeature-provider-js/compare/integration-react-v0.0.5...integration-react-v0.0.6) (2023-10-26)


### ✨ New Features

* **examples:** add next 12 and next 13 example apps ([151015a](https://github.com/spotify/confidence-openfeature-provider-js/commit/151015a03f7fe67a7c6382078743b38f8d6ef2d1))


### 📚 Documentation

* **react:** add docs for usage in Next 12 and 13 ([96faf2e](https://github.com/spotify/confidence-openfeature-provider-js/commit/96faf2eed2e5f84346f1ffcfc9d274f36cfa7514))


### 🔄 Refactoring

* **react:** ensure inclusion in the client bundle for next13 apps ([4fcae19](https://github.com/spotify/confidence-openfeature-provider-js/commit/4fcae19849eb7459eb80c649de76d09f49b8cdbf))

## [0.0.5](https://github.com/spotify/confidence-openfeature-provider-js/compare/integration-react-v0.0.4...integration-react-v0.0.5) (2023-10-18)


### 🐛 Bug Fixes

* **react:** issue with multiple context updates ([2dd3857](https://github.com/spotify/confidence-openfeature-provider-js/commit/2dd385764bd9c01b3f88f34b2da80b023b52cad1))

## [0.0.4](https://github.com/spotify/confidence-openfeature-provider-js/compare/integration-react-v0.0.3...integration-react-v0.0.4) (2023-10-11)


### ✨ New Features

* **react:** expose cjs for react native ([71526f7](https://github.com/spotify/confidence-openfeature-provider-js/commit/71526f7d6dc20e7bf1c4ce8211f589d6f8efdee1)), closes [#10](https://github.com/spotify/confidence-openfeature-provider-js/issues/10)

## Change Log (Old)

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## <small>0.0.3 (2023-08-29)</small>

- fix: ensure the target output is esm or cjs ([3990909](https://github.com/spotify/confidence-openfeature-provider-js/commit/3990909))

## <small>0.0.2 (2023-08-29)</small>

- fix: bump openfeature sdks ([0d01b77](https://github.com/spotify/confidence-openfeature-provider-js/commit/0d01b77)), closes [#5](https://github.com/spotify/confidence-openfeature-provider-js/issues/5)
