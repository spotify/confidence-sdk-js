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

## [0.2.0-rc.0](https://github.com/spotify/confidence-openfeature-provider-js/compare/integration-react-v0.2.2...integration-react-v0.2.0-rc.0) (2024-05-02)


### ⚠ BREAKING CHANGES

* Since our peer dependency to `@openfeature/js-sdk` changed into `@openfeature/server-sdk`, users need to install the new package which is concidered a breaking change.
* **client-http,web,server,react,examples:** new required option: timeout

### 🐛 Bug Fixes

* bump openfeature sdks ([0d01b77](https://github.com/spotify/confidence-openfeature-provider-js/commit/0d01b778031c9623b045b45656cc7cc21846b8ac)), closes [#5](https://github.com/spotify/confidence-openfeature-provider-js/issues/5)
* ensure the target output is esm or cjs ([3990909](https://github.com/spotify/confidence-openfeature-provider-js/commit/3990909534d0e253df312543f0f756f8989aa294))
* **react:** issue with multiple context updates ([2dd3857](https://github.com/spotify/confidence-openfeature-provider-js/commit/2dd385764bd9c01b3f88f34b2da80b023b52cad1))
* set correct internal dependencies ([9db8544](https://github.com/spotify/confidence-openfeature-provider-js/commit/9db8544d35410715005f2db82750c87484387c40))


### ✨ New Features

* **client-http,web,server,react,examples:** add timeout for network request ([f460b97](https://github.com/spotify/confidence-openfeature-provider-js/commit/f460b97ec4e1c56375de52fd1eb664c7b9be1f35))
* make provider fetchImplementation optional ([cd242a6](https://github.com/spotify/confidence-openfeature-provider-js/commit/cd242a60804d5565f69d12ec0d35acf8d980f11e))
* **react:** expose cjs for react native ([71526f7](https://github.com/spotify/confidence-openfeature-provider-js/commit/71526f7d6dc20e7bf1c4ce8211f589d6f8efdee1)), closes [#10](https://github.com/spotify/confidence-openfeature-provider-js/issues/10)


### 🧹 Chore

* of bump core 1.1.0, web 1.0.3, server 1.13.5 ([#117](https://github.com/spotify/confidence-openfeature-provider-js/issues/117)) ([7934996](https://github.com/spotify/confidence-openfeature-provider-js/commit/793499690e5b18b1c26a6f8e317bce27252574d7))
* prepare versions [skip ci] ([c377e3d](https://github.com/spotify/confidence-openfeature-provider-js/commit/c377e3d6611011820bd7799860f96aa1f5fcbe0b))
* prepare versions [skip ci] ([99d0257](https://github.com/spotify/confidence-openfeature-provider-js/commit/99d02572459a332db6926bc10309f165e966431f))
* release main ([86023f5](https://github.com/spotify/confidence-openfeature-provider-js/commit/86023f5a9cb5c641213ae7754be2395174754119))
* release main ([f2461b2](https://github.com/spotify/confidence-openfeature-provider-js/commit/f2461b20ffca3c56183193856fe529542e880be7))
* release main ([bf00676](https://github.com/spotify/confidence-openfeature-provider-js/commit/bf00676216a4c9ca3f59ac01d5bf444ab5c24f85))
* release main ([46e0ddd](https://github.com/spotify/confidence-openfeature-provider-js/commit/46e0ddd79f7b5b3cdff630f773ff4c1f3009ec9c))
* release main ([a50774b](https://github.com/spotify/confidence-openfeature-provider-js/commit/a50774bd7b6cf2e139da5ea79341d825872b5b69))
* release main ([2bf37b7](https://github.com/spotify/confidence-openfeature-provider-js/commit/2bf37b7bab49dfe95fe753ad28689827d9885743))
* release main ([6066377](https://github.com/spotify/confidence-openfeature-provider-js/commit/6066377a115fb694a7af12ee1a7dc60f73b2fee3))
* release main ([c956895](https://github.com/spotify/confidence-openfeature-provider-js/commit/c956895674ddfa3a4779c3f03167a21501d290d6))
* release main ([#104](https://github.com/spotify/confidence-openfeature-provider-js/issues/104)) ([e434adc](https://github.com/spotify/confidence-openfeature-provider-js/commit/e434adc99a1668ffaf6ac95557a877b4af4c3cfb))
* release main ([#121](https://github.com/spotify/confidence-openfeature-provider-js/issues/121)) ([bf3ab8d](https://github.com/spotify/confidence-openfeature-provider-js/commit/bf3ab8dd47e57a642759ac22ecfac8ecb9ae1d65))
* release main ([#31](https://github.com/spotify/confidence-openfeature-provider-js/issues/31)) ([0353749](https://github.com/spotify/confidence-openfeature-provider-js/commit/0353749d82a14bb8db34aef3a9055097c202b898))
* release main ([#44](https://github.com/spotify/confidence-openfeature-provider-js/issues/44)) ([1e3bab4](https://github.com/spotify/confidence-openfeature-provider-js/commit/1e3bab432bdf07def4fa17995e9705af19eb5c64))
* remove next.js examples ([#119](https://github.com/spotify/confidence-openfeature-provider-js/issues/119)) ([c2929b1](https://github.com/spotify/confidence-openfeature-provider-js/commit/c2929b1f772b6cab83413360a0944b43737b4d47))
* upgrade OpenFeature dependencies ([8f27a92](https://github.com/spotify/confidence-openfeature-provider-js/commit/8f27a924aa5eb7662fdf73be6564eb2e3580b2fc))


### 📚 Documentation

* react integration deprecation ([#123](https://github.com/spotify/confidence-openfeature-provider-js/issues/123)) ([8e86d16](https://github.com/spotify/confidence-openfeature-provider-js/commit/8e86d165546dd5d6fd5e9b11b0f2af92f91f0adf))
* **react:** add docs for usage in Next 12 and 13 ([96faf2e](https://github.com/spotify/confidence-openfeature-provider-js/commit/96faf2eed2e5f84346f1ffcfc9d274f36cfa7514))
* **react:** add note on setting provider before setting context ([e785c22](https://github.com/spotify/confidence-openfeature-provider-js/commit/e785c2283913f1f4a9e3875d1638c4961f9a9a5b))
* **react:** add timeout to docs ([952b7b6](https://github.com/spotify/confidence-openfeature-provider-js/commit/952b7b6c6e067c1191dd2bc492fce16a76391b6b))


### 🔄 Refactoring

* providers depend on total confidence ([ac4a56b](https://github.com/spotify/confidence-openfeature-provider-js/commit/ac4a56be0e858cdccacd7fef248ebfec3a2e5dc0))
* **react:** ensure inclusion in the client bundle for next13 apps ([4fcae19](https://github.com/spotify/confidence-openfeature-provider-js/commit/4fcae19849eb7459eb80c649de76d09f49b8cdbf))
* **react:** use global url in e2e tests ([9dbe2be](https://github.com/spotify/confidence-openfeature-provider-js/commit/9dbe2be3493025916e5596842be6b9a645edcc60))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spotify-confidence/openfeature-web-provider bumped from ^0.2.2-rc.0 to ^0.2.0-rc.0

## [0.2.2-rc.0](https://github.com/spotify/confidence-openfeature-provider-js/compare/integration-react-v0.2.1-rc.0...integration-react-v0.2.2-rc.0) (2024-04-30)


### 🧹 Chore

* of bump core 1.1.0, web 1.0.3, server 1.13.5 ([#117](https://github.com/spotify/confidence-openfeature-provider-js/issues/117)) ([7934996](https://github.com/spotify/confidence-openfeature-provider-js/commit/793499690e5b18b1c26a6f8e317bce27252574d7))
* remove next.js examples ([#119](https://github.com/spotify/confidence-openfeature-provider-js/issues/119)) ([c2929b1](https://github.com/spotify/confidence-openfeature-provider-js/commit/c2929b1f772b6cab83413360a0944b43737b4d47))


### 📚 Documentation

* react integration deprecation ([#123](https://github.com/spotify/confidence-openfeature-provider-js/issues/123)) ([8e86d16](https://github.com/spotify/confidence-openfeature-provider-js/commit/8e86d165546dd5d6fd5e9b11b0f2af92f91f0adf))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @spotify-confidence/openfeature-web-provider bumped from ^0.2.1-rc.0 to ^0.2.2-rc.0

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
