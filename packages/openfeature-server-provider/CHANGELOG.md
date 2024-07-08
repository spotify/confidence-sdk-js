# Changelog

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from ^0.1.2 to ^0.1.3

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/sdk bumped from 0.0.2 to 0.0.3

### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spotify-confidence/sdk bumped from 0.1.4 to 0.1.5

## [0.2.9](https://github.com/spotify/confidence-sdk-js/compare/openfeature-server-provider-v0.2.8...openfeature-server-provider-v0.2.9) (2024-06-07)


### 🧹 Chore

* release main ([#163](https://github.com/spotify/confidence-sdk-js/issues/163)) ([4849f31](https://github.com/spotify/confidence-sdk-js/commit/4849f31c8cf1a3c6b402bd2372a81d180d58be28))

## [0.2.8](https://github.com/spotify/confidence-sdk-js/compare/openfeature-server-provider-v0.2.7...openfeature-server-provider-v0.2.8) (2024-06-04)


### 🐛 Bug Fixes

* cache timeouts ([#157](https://github.com/spotify/confidence-sdk-js/issues/157)) ([357bb02](https://github.com/spotify/confidence-sdk-js/commit/357bb025b02183f26700fa5df857d3528a51f747)), closes [#155](https://github.com/spotify/confidence-sdk-js/issues/155)

## [0.2.7](https://github.com/spotify/confidence-sdk-js/compare/openfeature-server-provider-v0.2.5...openfeature-server-provider-v0.2.7) (2024-06-03)


### 🧹 Chore

* release main ([#149](https://github.com/spotify/confidence-sdk-js/issues/149)) ([2e6cbcc](https://github.com/spotify/confidence-sdk-js/commit/2e6cbcc1cf98ecaab764c969426924edcc21199d))

## [0.2.5](https://github.com/spotify/confidence-sdk-js/compare/openfeature-server-provider-v0.2.4...openfeature-server-provider-v0.2.5) (2024-05-28)


### 🐛 Bug Fixes

* npm deployment ([#146](https://github.com/spotify/confidence-sdk-js/issues/146)) ([0c93173](https://github.com/spotify/confidence-sdk-js/commit/0c931732a8c8df4b73d5e7a5b3bcda21684cb441))

## [0.2.4](https://github.com/spotify/confidence-sdk-js/compare/openfeature-server-provider-v0.2.3...openfeature-server-provider-v0.2.4) (2024-05-27)


### 🐛 Bug Fixes

* widen flag return types ([#142](https://github.com/spotify/confidence-sdk-js/issues/142)) ([6554e8c](https://github.com/spotify/confidence-sdk-js/commit/6554e8c83c6c49103f11fbdcf3f53c5576870788))


### ✨ New Features

* confidence flag api ([#141](https://github.com/spotify/confidence-sdk-js/issues/141)) ([3583415](https://github.com/spotify/confidence-sdk-js/commit/3583415957915a4d181316b66e5549071836799f))

## [0.2.3](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.2.2-rc.0...openfeature-server-provider-v0.2.3) (2024-05-03)


### ⚠ BREAKING CHANGES

* move sdk to peer dependencies ([#127](https://github.com/spotify/confidence-openfeature-provider-js/issues/127))

### ✨ New Features

* resolve flags on context change ([#128](https://github.com/spotify/confidence-openfeature-provider-js/issues/128)) ([184d5c5](https://github.com/spotify/confidence-openfeature-provider-js/commit/184d5c56f3ee4e428c72a1fa500197b9e7aca8d7))


### 🛠️ Build

* move sdk to peer dependencies ([#127](https://github.com/spotify/confidence-openfeature-provider-js/issues/127)) ([f7858c8](https://github.com/spotify/confidence-openfeature-provider-js/commit/f7858c86940e01c0bf18f3a0a2f97fe1508377f9))


### 🚦 CI

* drop "rc" from version: server-provider ([0d15f00](https://github.com/spotify/confidence-openfeature-provider-js/commit/0d15f002a079782ba1d3b12741e774d84e87a932))
* drop "rc" from version: web-provider ([1576712](https://github.com/spotify/confidence-openfeature-provider-js/commit/1576712ef7c20bca44da8a09b00abef13a0224e5))

## [0.2.2-rc.0](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.2.1-rc.0...openfeature-server-provider-v0.2.2-rc.0) (2024-04-30)


### 🧹 Chore

* of bump core 1.1.0, web 1.0.3, server 1.13.5 ([#117](https://github.com/spotify/confidence-openfeature-provider-js/issues/117)) ([7934996](https://github.com/spotify/confidence-openfeature-provider-js/commit/793499690e5b18b1c26a6f8e317bce27252574d7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/sdk bumped from 0.0.3 to 0.0.4

## [0.2.0-rc.0](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-server-provider-v0.1.5...openfeature-server-provider-v0.2.0-rc.0) (2024-04-04)


### ⚠ BREAKING CHANGES

* Since our peer dependency to `@openfeature/js-sdk` changed into `@openfeature/server-sdk`, users need to install the new package which is concidered a breaking change.

### ✨ New Features

* make provider fetchImplementation optional ([cd242a6](https://github.com/spotify/confidence-openfeature-provider-js/commit/cd242a60804d5565f69d12ec0d35acf8d980f11e))
* send sdk info with apply events ([6b95d0e](https://github.com/spotify/confidence-openfeature-provider-js/commit/6b95d0ea90059cae6fd71882a13a65ee84eb0e2c))


### 🧹 Chore

* upgrade OpenFeature dependencies ([8f27a92](https://github.com/spotify/confidence-openfeature-provider-js/commit/8f27a924aa5eb7662fdf73be6564eb2e3580b2fc))


### 📚 Documentation

* update readme with setProviderAndWait ([6dd6847](https://github.com/spotify/confidence-openfeature-provider-js/commit/6dd6847ce513f31491ed88f75cd13d7f598bc366))


### 🔄 Refactoring

* providers depend on total confidence ([ac4a56b](https://github.com/spotify/confidence-openfeature-provider-js/commit/ac4a56be0e858cdccacd7fef248ebfec3a2e5dc0))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/sdk bumped from 0.0.1 to 0.0.2

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
