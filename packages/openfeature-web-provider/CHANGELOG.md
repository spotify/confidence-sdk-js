# Changelog

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from ^0.1.2 to ^0.1.3

## [0.2.0-rc.0](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-web-provider-v0.1.5...openfeature-web-provider-v0.2.0-rc.0) (2024-04-04)


### ⚠ BREAKING CHANGES

* Since our peer dependency to `@openfeature/js-sdk` changed into `@openfeature/server-sdk`, users need to install the new package which is concidered a breaking change.

### ✨ New Features

* **client-http:** improved request logic ([81aee93](https://github.com/spotify/confidence-openfeature-provider-js/commit/81aee937921d28851400d63284c0ab3a7a882ed1))
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

## [0.1.5](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-web-provider-v0.1.4...openfeature-web-provider-v0.1.5) (2024-02-01)


### 🐛 Bug Fixes

* allow the full flag to be resolved ([#56](https://github.com/spotify/confidence-openfeature-provider-js/issues/56)) ([fa4c7a8](https://github.com/spotify/confidence-openfeature-provider-js/commit/fa4c7a8641206b7212f50f7e42d953b3056e762c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from ^0.1.3 to ^0.1.4

## [0.1.3](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-web-provider-v0.1.2...openfeature-web-provider-v0.1.3) (2024-01-05)


### 🐛 Bug Fixes

* **web:** set max buffer size for apply ([f774150](https://github.com/spotify/confidence-openfeature-provider-js/commit/f774150d47b92ba6780af6e47a8705a32f7c35d6))


### ✨ New Features

* **web:** default to global region ([2f09c27](https://github.com/spotify/confidence-openfeature-provider-js/commit/2f09c275062b916f4e924e87dcc8256e9c23a6fc))


### 🔄 Refactoring

* **examples:** use the default region in an example (node) ([0bc03e7](https://github.com/spotify/confidence-openfeature-provider-js/commit/0bc03e79c36a6c72dcfc46f3ad1de069474fed53))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from ^0.1.1 to ^0.1.2

## [0.1.2](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-web-provider-v0.1.1...openfeature-web-provider-v0.1.2) (2023-11-16)


### 🐛 Bug Fixes

* **web,server,client-http:** send apply for flags with NO_SEGMENT_MATCH ([30b0956](https://github.com/spotify/confidence-openfeature-provider-js/commit/30b0956ae9f505552fae3b6cf19f670cd0c650f9))


### ✨ New Features

* **client-http,web,server:** send sdk version ([23245ac](https://github.com/spotify/confidence-openfeature-provider-js/commit/23245acc3200eb9b0315e0d8374d226f442c6607))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from ^0.1.0 to ^0.1.1

## [0.1.1](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-web-provider-v0.1.0...openfeature-web-provider-v0.1.1) (2023-11-16)


### 🐛 Bug Fixes

* set correct internal dependencies ([9db8544](https://github.com/spotify/confidence-openfeature-provider-js/commit/9db8544d35410715005f2db82750c87484387c40))

## [0.1.0](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-web-provider-v0.0.4...openfeature-web-provider-v0.1.0) (2023-11-15)


### ⚠ BREAKING CHANGES

* **client-http,web,server,react,examples:** new required option: timeout

### ✨ New Features

* **client-http,web,server,react,examples:** add timeout for network request ([f460b97](https://github.com/spotify/confidence-openfeature-provider-js/commit/f460b97ec4e1c56375de52fd1eb664c7b9be1f35))


### 📚 Documentation

* add concept apply docs ([0274284](https://github.com/spotify/confidence-openfeature-provider-js/commit/02742845d029e994c0f83c4acc2bff9f796a3dad))


### 🔄 Refactoring

* **web:** set access apply to default, add docs ([91d9ebf](https://github.com/spotify/confidence-openfeature-provider-js/commit/91d9ebff2ee826d6549587406e0ab61584ce0263))

## [0.0.4](https://github.com/spotify/confidence-openfeature-provider-js/compare/openfeature-web-provider-v0.0.3...openfeature-web-provider-v0.0.4) (2023-10-26)


### 🔄 Refactoring

* **client-http,web,server:** use a serializable and more simple configuration object ([fc2093f](https://github.com/spotify/confidence-openfeature-provider-js/commit/fc2093ff51d9525ca866854384751daa9148c6f6))

## Change Log (Old)

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## <small>0.0.3 (2023-08-29)</small>

- fix: ensure the target output is esm or cjs ([3990909](https://github.com/spotify/confidence-openfeature-provider-js/commit/3990909))

## <small>0.0.2 (2023-08-29)</small>

- fix: bump openfeature sdks ([0d01b77](https://github.com/spotify/confidence-openfeature-provider-js/commit/0d01b77)), closes [#5](https://github.com/spotify/confidence-openfeature-provider-js/issues/5)
