# Changelog

## [0.1.6](https://github.com/spotify/confidence-openfeature-provider-js/compare/client-http-v0.1.5...client-http-v0.1.6) (2024-05-03)


### ✨ New Features

* resolve flags on context change ([#128](https://github.com/spotify/confidence-openfeature-provider-js/issues/128)) ([184d5c5](https://github.com/spotify/confidence-openfeature-provider-js/commit/184d5c56f3ee4e428c72a1fa500197b9e7aca8d7))

## [0.1.5](https://github.com/spotify/confidence-openfeature-provider-js/compare/client-http-v0.1.4...client-http-v0.1.5) (2024-04-04)


### 🐛 Bug Fixes

* **client-http:** do not retry aborted requests ([22c2e0d](https://github.com/spotify/confidence-openfeature-provider-js/commit/22c2e0d01a09acc512a334a70d386eb6cdb8e8e5))


### ✨ New Features

* **client-http:** improved request logic ([81aee93](https://github.com/spotify/confidence-openfeature-provider-js/commit/81aee937921d28851400d63284c0ab3a7a882ed1))
* send sdk info with apply events ([6b95d0e](https://github.com/spotify/confidence-openfeature-provider-js/commit/6b95d0ea90059cae6fd71882a13a65ee84eb0e2c))
* total confidence sdk ([fe6ae99](https://github.com/spotify/confidence-openfeature-provider-js/commit/fe6ae9979fba51886005542ab5f3cc06a392bcc3))

## [0.1.4](https://github.com/spotify/confidence-openfeature-provider-js/compare/client-http-v0.1.3...client-http-v0.1.4) (2024-02-01)


### 🐛 Bug Fixes

* allow the full flag to be resolved ([#56](https://github.com/spotify/confidence-openfeature-provider-js/issues/56)) ([fa4c7a8](https://github.com/spotify/confidence-openfeature-provider-js/commit/fa4c7a8641206b7212f50f7e42d953b3056e762c))

## [0.1.3](https://github.com/spotify/confidence-openfeature-provider-js/compare/client-http-v0.1.2...client-http-v0.1.3) (2024-01-22)


### 🐛 Bug Fixes

* **client-http:** duplicate events on buffer overflow ([57ff968](https://github.com/spotify/confidence-openfeature-provider-js/commit/57ff9680931a11ee4db9fe80e54592e878bc21eb))

## [0.1.2](https://github.com/spotify/confidence-openfeature-provider-js/compare/client-http-v0.1.1...client-http-v0.1.2) (2024-01-05)


### 🐛 Bug Fixes

* **client-http:** set max buffer size for apply ([5c3ea7d](https://github.com/spotify/confidence-openfeature-provider-js/commit/5c3ea7dd6565b3983f12ba3dcc7a8a449dfcc1bb))
* **web:** set max buffer size for apply ([f774150](https://github.com/spotify/confidence-openfeature-provider-js/commit/f774150d47b92ba6780af6e47a8705a32f7c35d6))


### ✨ New Features

* **client-http:** default to the global url ([ada8268](https://github.com/spotify/confidence-openfeature-provider-js/commit/ada82680cf25e4d4a17a647210a62d4caa42ccfa))


### 🔄 Refactoring

* **examples:** use the default region in an example (node) ([0bc03e7](https://github.com/spotify/confidence-openfeature-provider-js/commit/0bc03e79c36a6c72dcfc46f3ad1de069474fed53))

## [0.1.1](https://github.com/spotify/confidence-openfeature-provider-js/compare/client-http-v0.1.0...client-http-v0.1.1) (2023-11-16)


### 🐛 Bug Fixes

* **web,server,client-http:** send apply for flags with NO_SEGMENT_MATCH ([30b0956](https://github.com/spotify/confidence-openfeature-provider-js/commit/30b0956ae9f505552fae3b6cf19f670cd0c650f9))


### ✨ New Features

* **client-http,web,server:** send sdk version ([23245ac](https://github.com/spotify/confidence-openfeature-provider-js/commit/23245acc3200eb9b0315e0d8374d226f442c6607))

## [0.1.0](https://github.com/spotify/confidence-openfeature-provider-js/compare/client-http-v0.0.3...client-http-v0.1.0) (2023-11-15)


### ⚠ BREAKING CHANGES

* **client-http,web,server,react,examples:** new required option: timeout

### ✨ New Features

* **client-http,web,server,react,examples:** add timeout for network request ([f460b97](https://github.com/spotify/confidence-openfeature-provider-js/commit/f460b97ec4e1c56375de52fd1eb664c7b9be1f35))

## [0.0.3](https://github.com/spotify/confidence-openfeature-provider-js/compare/client-http-v0.0.2...client-http-v0.0.3) (2023-10-26)


### 🔄 Refactoring

* **client-http,web,server:** use a serializable and more simple configuration object ([fc2093f](https://github.com/spotify/confidence-openfeature-provider-js/commit/fc2093ff51d9525ca866854384751daa9148c6f6))

## Change Log (Old)

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## <small>0.0.2 (2023-08-29)</small>

- fix: ensure the target output is esm or cjs ([3990909](https://github.com/spotify/confidence-openfeature-provider-js/commit/3990909))
