# Changelog

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from ^0.1.2 to ^0.1.3

## [0.2.2](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.2.1...openfeature-server-provider-v0.2.2) (2024-04-03)


### ✨ New Features

* Total confidence fake PR ([#84](https://github.com/spotify/confidence-openfeature-provider-js/issues/84)) ([113c105](https://github.com/spotify/confidence-openfeature-provider-js/commit/113c105807d0f1e7475c2151ff875ad8c5478ec4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/sdk bumped from 0.0.1 to 0.0.2

## [0.2.1](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.2.0...openfeature-server-provider-v0.2.1) (2024-03-28)


### ✨ New Features

* make provider fetchImplementation optional ([0a7eb86](https://github.com/spotify/confidence-openfeature-provider-js/commit/0a7eb866c96352012deae19638f851049ed9894a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from 0.1.5 to 0.1.6

## [0.2.0](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.1.5...openfeature-server-provider-v0.2.0) (2024-02-15)


### ⚠ BREAKING CHANGES

* Since our peer dependency to `@openfeature/js-sdk` changed into `@openfeature/server-sdk`, users need to install the new package which is concidered a breaking change.

### ✨ New Features

* send sdk info with apply events ([6b95d0e](https://github.com/spotify/confidence-openfeature-provider-js/commit/6b95d0ea90059cae6fd71882a13a65ee84eb0e2c))


### 🧹 Chore

* upgrade OpenFeature dependencies ([8f27a92](https://github.com/spotify/confidence-openfeature-provider-js/commit/8f27a924aa5eb7662fdf73be6564eb2e3580b2fc))


### 📚 Documentation

* update readme with setProviderAndWait ([6dd6847](https://github.com/spotify/confidence-openfeature-provider-js/commit/6dd6847ce513f31491ed88f75cd13d7f598bc366))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from 0.1.4 to 0.1.5

## [0.1.5](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.1.4...openfeature-server-provider-v0.1.5) (2024-02-01)


### 🐛 Bug Fixes

* allow the full flag to be resolved ([#56](https://github.com/spotify/confidence-openfeature-provider-js/issues/56)) ([fa4c7a8](https://github.com/spotify/confidence-openfeature-provider-js/commit/fa4c7a8641206b7212f50f7e42d953b3056e762c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from ^0.1.3 to ^0.1.4

## [0.1.3](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.1.2...openfeature-server-provider-v0.1.3) (2024-01-05)


### ✨ New Features

* **server:** default to global region ([c87a9d0](https://github.com/spotify/confidence-openfeature-provider-js/commit/c87a9d045e7de02bd98930c50b622768b18fedc8))


### 🔄 Refactoring

* **examples:** use the default region in an example (node) ([0bc03e7](https://github.com/spotify/confidence-openfeature-provider-js/commit/0bc03e79c36a6c72dcfc46f3ad1de069474fed53))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from ^0.1.1 to ^0.1.2

## [0.1.2](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.1.1...openfeature-server-provider-v0.1.2) (2023-11-16)


### 🐛 Bug Fixes

* **web,server,client-http:** send apply for flags with NO_SEGMENT_MATCH ([30b0956](https://github.com/spotify/confidence-openfeature-provider-js/commit/30b0956ae9f505552fae3b6cf19f670cd0c650f9))


### ✨ New Features

* **client-http,web,server:** send sdk version ([23245ac](https://github.com/spotify/confidence-openfeature-provider-js/commit/23245acc3200eb9b0315e0d8374d226f442c6607))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from ^0.1.0 to ^0.1.1

## [0.1.1](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.1.0...openfeature-server-provider-v0.1.1) (2023-11-16)


### 🐛 Bug Fixes

* set correct internal dependencies ([9db8544](https://github.com/spotify/confidence-openfeature-provider-js/commit/9db8544d35410715005f2db82750c87484387c40))

## [0.1.0](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.0.5...openfeature-server-provider-v0.1.0) (2023-11-15)


### ⚠ BREAKING CHANGES

* **client-http,web,server,react,examples:** new required option: timeout

### 🐛 Bug Fixes

* **server:** remove access apply, add docs ([b2926c8](https://github.com/spotify/confidence-openfeature-provider-js/commit/b2926c8bf80d0e18f87e0d2191a537e517a17c9c))


### ✨ New Features

* **client-http,web,server,react,examples:** add timeout for network request ([f460b97](https://github.com/spotify/confidence-openfeature-provider-js/commit/f460b97ec4e1c56375de52fd1eb664c7b9be1f35))


### 🔄 Refactoring

* **web:** set access apply to default, add docs ([91d9ebf](https://github.com/spotify/confidence-openfeature-provider-js/commit/91d9ebff2ee826d6549587406e0ab61584ce0263))

## [0.0.5](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.0.4...openfeature-server-provider-v0.0.5) (2023-10-26)


### 🔄 Refactoring

* **client-http,web,server:** use a serializable and more simple configuration object ([fc2093f](https://github.com/spotify/confidence-openfeature-provider-js/commit/fc2093ff51d9525ca866854384751daa9148c6f6))

## [0.0.4](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.0.3...openfeature-server-provider-v0.0.4) (2023-10-18)


### 🐛 Bug Fixes

* **server:** do not cache request ([#26](https://github.com/spotify/confidence-openfeature-provider-js/issues/26)) ([8205694](https://github.com/spotify/confidence-openfeature-provider-js/commit/82056948938a0d47418cb437bc1319ddd5ff10f7))


### ✨ New Features

* **examples:** add node js commonjs example ([9e9b2ad](https://github.com/spotify/confidence-openfeature-provider-js/commit/9e9b2add53ac26276d890d77f113c2e61d953ff6))


### 📚 Documentation

* **server:** update docs with correct example ([ff794fa](https://github.com/spotify/confidence-openfeature-provider-js/commit/ff794fadf2eb942622e4b0eaf9666b5db0059625))

## Change Log (Old)

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## <small>0.0.3 (2023-08-29)</small>

- fix: ensure the target output is esm or cjs ([3990909](https://github.com/spotify/confidence-openfeature-provider-js/commit/3990909))

## <small>0.0.2 (2023-08-29)</small>

- fix: bump openfeature sdks ([0d01b77](https://github.com/spotify/confidence-openfeature-provider-js/commit/0d01b77)), closes [#5](https://github.com/spotify/confidence-openfeature-provider-js/issues/5)
