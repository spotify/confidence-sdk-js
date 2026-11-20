# @spotify-confidence/device-info

Detects the OS, browser and form factor of a browser, shared by the Confidence SDK (`deviceInfo` tracker) and the session recording SDK so both report the same device.

```ts
import { getDeviceInfo, parseDeviceInfo } from '@spotify-confidence/device-info';

getDeviceInfo();
// { os: { name: 'iOS', version: '26.1' }, browser: { name: 'Safari', version: '26' }, formFactor: 'mobile', webview: false, bot: false, touch: true }

parseDeviceInfo(userAgent, userAgentData, maxTouchPoints);
```

`getDeviceInfo()` reads the current `navigator` and returns `undefined` outside the browser. `parseDeviceInfo()` works on any user agent, for example on a server.

Parsing uses [bowser](https://github.com/bowser-js/bowser), with these corrections:

- **OS names** match the Confidence iOS and Android SDKs: `iOS`, `iPadOS`, `android`, `macOS`, `Windows`, `ChromeOS`, `Linux`, or `Unknown`.
- **Frozen or fake versions are left out:** Windows and macOS (frozen at `10.0` and `10.15.7`), Linux, ChromeOS, and Chromium's reduced Android user agent (always `Android 10`).
- **Safari 26 and later** reports iOS and iPadOS as `18.6`, so the OS version is taken from Safari's own version.
- **iPads in desktop mode** report macOS; they are detected by touch support and reported as `iPadOS` and `tablet`.
- **Android TVs, set-top boxes, VR headsets and car displays** are reported as `desktop`, not `tablet`.
- **`navigator.userAgentData`** is preferred where available, for the browser brand (Chrome, Edge, Opera, Brave), mobile flag and platform.
- **`browser.version`** is the major version only.

It also reports:

- **`inAppBrowser`:** the app whose built-in browser opened the page: `instagram`, `facebook`, `messenger`, `tiktok`, `snapchat`, `linkedin`, `pinterest`, `x`, `wechat`, `line` or `google` (the Google app). Detected from tokens the apps add to the user agent, which they sometimes change.
- **`webview`:** whether the page runs in an app's web view (Android `wv`, or iOS and iPads in desktop mode without the `Safari/` token), including in-app browsers.
- **`bot`:** whether the user agent belongs to a crawler (including AI crawlers), a monitoring tool such as Lighthouse, headless Chrome or an HTTP library. `getDeviceInfo()` also sets it when `navigator.webdriver` is true. User agents can be faked, so treat this as a filter, not a security check.

The session recording SDK skips sessions where `bot` is true unless `recordBots: true` is set.
