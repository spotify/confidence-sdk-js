# Changelog

## [0.0.3](https://github.com/spotify/confidence-openfeature-provider-js/compare/sdk-v0.0.2...sdk-v0.0.3) (2024-04-23)


### 🐛 Bug Fixes

* allow closer functions to throw ([4dcc0a3](https://github.com/spotify/confidence-openfeature-provider-js/commit/4dcc0a37c6252500edf28207311fb3f514e79f44))
* default ttfb to false ([294ae52](https://github.com/spotify/confidence-openfeature-provider-js/commit/294ae521e8aab6c333783d00752f9278f710b16a))
* fix some linting ([617631e](https://github.com/spotify/confidence-openfeature-provider-js/commit/617631e350d70b0b2937661b7678c8f046957f30))
* formatting ([5f1417a](https://github.com/spotify/confidence-openfeature-provider-js/commit/5f1417a34db6986910764c54437dc865c955355a))
* minor fixes + logging ([e19f332](https://github.com/spotify/confidence-openfeature-provider-js/commit/e19f33221d92a720e779d5b03ef4e5ed0c858e64))
* remove unnecessary async ([8cdef28](https://github.com/spotify/confidence-openfeature-provider-js/commit/8cdef28eb710599b48a19745e4af54e9faccf5af))
* rename Visitor back to visitor_id ([cf643dc](https://github.com/spotify/confidence-openfeature-provider-js/commit/cf643dcdd91f8d26d78b0d87abc0ebbc9927b492))
* rename visitorId to Visitor 😢 ([ea601be](https://github.com/spotify/confidence-openfeature-provider-js/commit/ea601bea6b028acbea36c0f4189a2fa5caf06301))
* tracking cleanup ([f6f33e9](https://github.com/spotify/confidence-openfeature-provider-js/commit/f6f33e96ed6f4031309e84d0d57f69f2f34cd9b3))
* update event name for page view ([8080a75](https://github.com/spotify/confidence-openfeature-provider-js/commit/8080a750e331842851167215268da15acde79a2f))
* update web vitals to use inp ([6c5943d](https://github.com/spotify/confidence-openfeature-provider-js/commit/6c5943d2b3685c9c9de2c8acaa5d45c7d81a85f8))


### ✨ New Features

* add support for ttfb in webvitals ([098022d](https://github.com/spotify/confidence-openfeature-provider-js/commit/098022d95005c4b6dec7f182c3653a1a59b99fb9))
* context provider support ([baaa4a0](https://github.com/spotify/confidence-openfeature-provider-js/commit/baaa4a032dac10f64f3b2393a7fad324e7396061))
* enable logging in trackers ([a8286a9](https://github.com/spotify/confidence-openfeature-provider-js/commit/a8286a93f42115c7849ffd5cc000a90cb2bb372c))
* initial pageView producer ([9aed408](https://github.com/spotify/confidence-openfeature-provider-js/commit/9aed4087be8d2afd21beeb0278ce4b97e95b5834))
* simplified track api ([8003f76](https://github.com/spotify/confidence-openfeature-provider-js/commit/8003f766632c0ddafc066448fbf96d956cc3dd6e))
* track api ([a1924ac](https://github.com/spotify/confidence-openfeature-provider-js/commit/a1924ac793ac5d106da1328a0dbab93423ea5e99))
* trackable ([10f62ef](https://github.com/spotify/confidence-openfeature-provider-js/commit/10f62ef4fc962a037c3a19193d37d28f703c2926))
* web vitals producer ([486bfeb](https://github.com/spotify/confidence-openfeature-provider-js/commit/486bfebc8802074c6e7c9f985ec2e5132bfaa234))


### 🔄 Refactoring

* change the properties on webvitals message ([15e1905](https://github.com/spotify/confidence-openfeature-provider-js/commit/15e1905191d04ac5bb91f62f6a7fdcf279d1ca15))
* clean up commented code ([e51b04f](https://github.com/spotify/confidence-openfeature-provider-js/commit/e51b04f1934b1afd45e421bd064405a568c9508c))
* clean up trackers ([cfd7605](https://github.com/spotify/confidence-openfeature-provider-js/commit/cfd76053d5d03e659256b719af66357c3c0b1320))
* confidence utils in example app ([a4acedf](https://github.com/spotify/confidence-openfeature-provider-js/commit/a4acedf852fa1ae7a46d4002d53a19fd017e53ad))
* extract to utils ([f9a7e27](https://github.com/spotify/confidence-openfeature-provider-js/commit/f9a7e27b4a0686563fbc1dc78fd5376ccc2e1b1f))
* minor refactors ([866b0c0](https://github.com/spotify/confidence-openfeature-provider-js/commit/866b0c011d6cd6cd005b3d5d14e3954fb5a0ac1b))
* move sendEvent function ([8df158a](https://github.com/spotify/confidence-openfeature-provider-js/commit/8df158ae8b64e444f709ae9e0f73d802f04acb62))
* remove user agent types for now ([8b3d519](https://github.com/spotify/confidence-openfeature-provider-js/commit/8b3d519f8331b31a4d5fdd9df29425aa39af8c8e))
* rename ForwardingController ([22a3693](https://github.com/spotify/confidence-openfeature-provider-js/commit/22a3693eb581f8e51e3d3d3647f9e646669ea5f7))
* rename producers to trackers ([c5cb294](https://github.com/spotify/confidence-openfeature-provider-js/commit/c5cb294ba8abd1041a50bd54c5b74a29d4df6784))
* various tracking related changes ([8cf56e0](https://github.com/spotify/confidence-openfeature-provider-js/commit/8cf56e0294a2714acad77edc7a32aa5ab086fa35))


### 🔙 Reverts

* context provider support ([2ee8194](https://github.com/spotify/confidence-openfeature-provider-js/commit/2ee8194229e9e5c26fcca29fac582571a6ccd879))
* remove close api ([1a9e7f7](https://github.com/spotify/confidence-openfeature-provider-js/commit/1a9e7f7ea9921198d273d150beb67595519f1a2d))

## [0.0.2](https://github.com/spotify/confidence-openfeature-provider-js/compare/sdk-v0.0.1...sdk-v0.0.2) (2024-04-04)


### ✨ New Features

* total confidence sdk ([fe6ae99](https://github.com/spotify/confidence-openfeature-provider-js/commit/fe6ae9979fba51886005542ab5f3cc06a392bcc3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spotify-confidence/client-http bumped from 0.1.4 to 0.1.5

## Changelog
