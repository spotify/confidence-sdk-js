# Changelog

## [0.2.2](https://github.com/spotify/confidence-sdk-js/compare/sdk-v0.2.1...sdk-v0.2.2) (2025-01-10)


### 🐛 Bug Fixes

* hanging resolve bug ([#212](https://github.com/spotify/confidence-sdk-js/issues/212)) ([7b22bc0](https://github.com/spotify/confidence-sdk-js/commit/7b22bc07d266226528fa511fec4465ad96570d1c))


### ✨ New Features

* Resolve Debug to redirect to UI tool on web ([#209](https://github.com/spotify/confidence-sdk-js/issues/209)) ([988707e](https://github.com/spotify/confidence-sdk-js/commit/988707e1ff607713093369cfcc4d615270c36856))
* Telemetry header ([#208](https://github.com/spotify/confidence-sdk-js/issues/208)) ([b0c8acb](https://github.com/spotify/confidence-sdk-js/commit/b0c8acbeddc2db68902bb6856ea11a6dee78f898))

## [0.2.1](https://github.com/spotify/confidence-sdk-js/compare/sdk-v0.2.0...sdk-v0.2.1) (2024-10-03)


### 🐛 Bug Fixes

* react-native runtime incompatibilities ([#202](https://github.com/spotify/confidence-sdk-js/issues/202)) ([f594e77](https://github.com/spotify/confidence-sdk-js/commit/f594e773db1a6077558a619513ba872bd5e15640))

## [0.2.0](https://github.com/spotify/confidence-sdk-js/compare/sdk-v0.1.6...sdk-v0.2.0) (2024-09-12)


### ⚠ BREAKING CHANGES

* visitor id disabled by default ([#199](https://github.com/spotify/confidence-sdk-js/issues/199))
* mark Confidence constructor as internal ([#195](https://github.com/spotify/confidence-sdk-js/issues/195))

### 🐛 Bug Fixes

* mark Confidence constructor as internal ([#195](https://github.com/spotify/confidence-sdk-js/issues/195)) ([1eb79c0](https://github.com/spotify/confidence-sdk-js/commit/1eb79c039dfcde30dd4a279f96b8b903e5b356ff))
* visitor id disabled by default ([#199](https://github.com/spotify/confidence-sdk-js/issues/199)) ([aea60c4](https://github.com/spotify/confidence-sdk-js/commit/aea60c466f9780e0fb252a74dd80a2834230a0b1))


### ✨ New Features

* add a custom baseURL for sidecar resolves ([#200](https://github.com/spotify/confidence-sdk-js/issues/200)) ([f838752](https://github.com/spotify/confidence-sdk-js/commit/f838752046abb0afa383dc2c8d421f196fddf8c7))


### 📚 Documentation

* clarify importance of withContext in server usage ([#197](https://github.com/spotify/confidence-sdk-js/issues/197)) ([57aad0a](https://github.com/spotify/confidence-sdk-js/commit/57aad0a31cf14fd0e97f606630a2ac8d056d9fe4))
* fix styling of alert box ([#198](https://github.com/spotify/confidence-sdk-js/issues/198)) ([935a195](https://github.com/spotify/confidence-sdk-js/commit/935a19548b462dd886a5128f30b7b61559dbfdc3))


### 🔄 Refactoring

* remove the widen type ([#193](https://github.com/spotify/confidence-sdk-js/issues/193)) ([99c9659](https://github.com/spotify/confidence-sdk-js/commit/99c9659e857ad862f6273fe2209abdd47073440c))

## [0.1.6](https://github.com/spotify/confidence-sdk-js/compare/sdk-v0.1.5...sdk-v0.1.6) (2024-08-20)


### 🐛 Bug Fixes

* use main&module instead of exports ([5cc01b6](https://github.com/spotify/confidence-sdk-js/commit/5cc01b6c4f7cc9d0857e35ddfcca5cad3ae4d85b))


### 🧹 Chore

* update package json to expose both es and cjs ([5cc01b6](https://github.com/spotify/confidence-sdk-js/commit/5cc01b6c4f7cc9d0857e35ddfcca5cad3ae4d85b))


### 📚 Documentation

* add documentation to the SDK to resolve MD warnings ([#177](https://github.com/spotify/confidence-sdk-js/issues/177)) ([956594b](https://github.com/spotify/confidence-sdk-js/commit/956594b3f666de3eb9567f7b4855d69a6057d2d0))

## [0.1.5](https://github.com/spotify/confidence-sdk-js/compare/sdk-v0.1.4...sdk-v0.1.5) (2024-07-08)


### 🐛 Bug Fixes

* infinite in memory flag cache ([#170](https://github.com/spotify/confidence-sdk-js/issues/170)) ([9156dd7](https://github.com/spotify/confidence-sdk-js/commit/9156dd70942f295c4f45125137c022526b15ffdb))
* shared requests aborted ([#169](https://github.com/spotify/confidence-sdk-js/issues/169)) ([9dc6314](https://github.com/spotify/confidence-sdk-js/commit/9dc6314fab1028af940a672adc5811ec35c570ea))

## [0.1.4](https://github.com/spotify/confidence-sdk-js/compare/sdk-v0.1.3...sdk-v0.1.4) (2024-06-05)


### 🐛 Bug Fixes

* invalid d.ts generation ([#162](https://github.com/spotify/confidence-sdk-js/issues/162)) ([ac1c415](https://github.com/spotify/confidence-sdk-js/commit/ac1c415b35d4a2a31d73791097ae5bc43047d994))

## [0.1.3](https://github.com/spotify/confidence-sdk-js/compare/sdk-v0.1.2...sdk-v0.1.3) (2024-06-04)


### 🐛 Bug Fixes

* cache timeouts ([#157](https://github.com/spotify/confidence-sdk-js/issues/157)) ([357bb02](https://github.com/spotify/confidence-sdk-js/commit/357bb025b02183f26700fa5df857d3528a51f747)), closes [#155](https://github.com/spotify/confidence-sdk-js/issues/155)

## [0.1.2](https://github.com/spotify/confidence-sdk-js/compare/sdk-v0.1.0...sdk-v0.1.2) (2024-06-03)


### 🐛 Bug Fixes

* excessive promises created by PendingResolution ([f0b97ef](https://github.com/spotify/confidence-sdk-js/commit/f0b97efd5b6b49654be61117d2aa7415ff8b87e9))

## [0.1.0](https://github.com/spotify/confidence-sdk-js/compare/sdk-v0.0.7...sdk-v0.1.0) (2024-05-31)


### ⚠ BREAKING CHANGES

* react support ([#145](https://github.com/spotify/confidence-sdk-js/issues/145))

### 🐛 Bug Fixes

* pageviews: handle missed load event ([#148](https://github.com/spotify/confidence-sdk-js/issues/148)) ([ae6bd43](https://github.com/spotify/confidence-sdk-js/commit/ae6bd436c8c66993f722d82d3dbbba7734c79543))


### ✨ New Features

* react support ([#145](https://github.com/spotify/confidence-sdk-js/issues/145)) ([0493005](https://github.com/spotify/confidence-sdk-js/commit/04930050ef970b8e0481b01fe005321723532ff3))

## [0.0.7](https://github.com/spotify/confidence-sdk-js/compare/sdk-v0.0.6...sdk-v0.0.7) (2024-05-28)


### 🐛 Bug Fixes

* npm deployment ([#146](https://github.com/spotify/confidence-sdk-js/issues/146)) ([0c93173](https://github.com/spotify/confidence-sdk-js/commit/0c931732a8c8df4b73d5e7a5b3bcda21684cb441))

## [0.0.6](https://github.com/spotify/confidence-sdk-js/compare/sdk-v0.0.5...sdk-v0.0.6) (2024-05-27)


### 🐛 Bug Fixes

* widen flag return types ([#142](https://github.com/spotify/confidence-sdk-js/issues/142)) ([6554e8c](https://github.com/spotify/confidence-sdk-js/commit/6554e8c83c6c49103f11fbdcf3f53c5576870788))


### ✨ New Features

* confidence flag api ([#141](https://github.com/spotify/confidence-sdk-js/issues/141)) ([3583415](https://github.com/spotify/confidence-sdk-js/commit/3583415957915a4d181316b66e5549071836799f))
* send context as a struct ([#144](https://github.com/spotify/confidence-sdk-js/issues/144)) ([2f73b3b](https://github.com/spotify/confidence-sdk-js/commit/2f73b3b519082fa58a64de3d3be957571dc72a00))


### 📚 Documentation

* update main README.md ([#134](https://github.com/spotify/confidence-sdk-js/issues/134)) ([730fceb](https://github.com/spotify/confidence-sdk-js/commit/730fcebbc87fdab7b39817ab61e1ef23951e3466))

## [0.0.5](https://github.com/spotify/confidence-openfeature-provider-js/compare/sdk-v0.0.4...sdk-v0.0.5) (2024-05-03)


### ✨ New Features

* default info logging to console in development ([#133](https://github.com/spotify/confidence-openfeature-provider-js/issues/133)) ([cd1420c](https://github.com/spotify/confidence-openfeature-provider-js/commit/cd1420cefa6b1e2c48a688aee3c15019598412d0))
* resolve flags on context change ([#128](https://github.com/spotify/confidence-openfeature-provider-js/issues/128)) ([184d5c5](https://github.com/spotify/confidence-openfeature-provider-js/commit/184d5c56f3ee4e428c72a1fa500197b9e7aca8d7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from 0.1.5 to 0.1.6

## [0.0.4](https://github.com/spotify/confidence-openfeature-provider-js/compare/sdk-v0.0.3...sdk-v0.0.4) (2024-04-30)


### 🔄 Refactoring

* remove message container ([#122](https://github.com/spotify/confidence-openfeature-provider-js/issues/122)) ([fbc8c2a](https://github.com/spotify/confidence-openfeature-provider-js/commit/fbc8c2a12fd2b560b1722869c831dbf6b60c8cd4))

## [0.0.3](https://github.com/spotify/confidence-openfeature-provider-js/compare/sdk-v0.0.2...sdk-v0.0.3) (2024-04-24)


### ✨ New Features

* managed contexts and events ([#102](https://github.com/spotify/confidence-openfeature-provider-js/issues/102)) ([a6dc75c](https://github.com/spotify/confidence-openfeature-provider-js/commit/a6dc75c147b50cda9ce27a1c0ca622cd191c7142))


### 📚 Documentation

* update sendEvent in example app ([#114](https://github.com/spotify/confidence-openfeature-provider-js/issues/114)) ([a19ba68](https://github.com/spotify/confidence-openfeature-provider-js/commit/a19ba683ffbb8cfc959d2484adc4f564b2278a41))


### 🔄 Refactoring

* add message container to payload ([#106](https://github.com/spotify/confidence-openfeature-provider-js/issues/106)) ([31b0eec](https://github.com/spotify/confidence-openfeature-provider-js/commit/31b0eecdefb1d1cb947a0fada0d6683d13dbc9ea))
* rename sendEvent to track ([#113](https://github.com/spotify/confidence-openfeature-provider-js/issues/113)) ([1d4cade](https://github.com/spotify/confidence-openfeature-provider-js/commit/1d4cadec1ac2ad2dd14a3b845e0abc6fa9d29660))

## [0.0.2](https://github.com/spotify/confidence-openfeature-provider-js/compare/sdk-v0.0.1...sdk-v0.0.2) (2024-04-04)


### ✨ New Features

* total confidence sdk ([fe6ae99](https://github.com/spotify/confidence-openfeature-provider-js/commit/fe6ae9979fba51886005542ab5f3cc06a392bcc3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from 0.1.4 to 0.1.5

## Changelog
