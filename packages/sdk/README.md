# Confidence SDK

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

JavaScript implementation of the Confidence SDK, enables event tracking and feature flagging capabilities in conjunction wth the OpenFeature Web SDK.

# Usage

## Adding the dependencies

To add the packages to your dependencies run:

```sh
yarn add @spotify-confidence/sdk
```

## Initializing the SDK

Run the `Confidence.create` function to obtain a root instance of `Confidence`.

```ts
import { Confidence } from '@spotify-confidence/sdk';

const confidence = Confidence.create({
  clientSecret: 'mysecret',
  region: 'eu',
  environment: 'client',
  timeout: 1000,
});
```

### Region

The region option is used to set the region for the network request to the Confidence backend. When the region is not set, the default (global) region will be used.
The current regions are: `eu` and `us`, the region can be set as follows:

```ts
const provider = createConfidenceWebProvider({
  region: 'eu', // or 'us'
  // ... other options
});
```

### Timeout

The timeout option is used to set the timeout for the feature flag resolve network request to the Confidence backend. When the timeout is reached, default values will be returned.

## Setting the context

You can set the context manually by using `setContext({})`:

```ts
confidence.setContext({ 'pants-color': 'yellow' });
```

or obtain a "child instance" of Confidence with a modified context by using `withContext({})`

```ts
const childInstance = confidence.withContext({ 'pants-color': 'blue', 'pants-fit': 'slim' });
```

At this point, the context of `childInstance` is `'pants-color': 'blue', 'pants-fit': 'slim'` while the context of `confidence` remains `{'pants-color': 'yellow'}`.

## Event tracking

Use `confidence.track()` from any Confidence instance to track an event in Confidence. Any context data set on the instance will be appended to the tracking event.

```ts
confidence.track('event_name', { 'message-detail1': 'something interesting' });
```

### Auto track

Confidence supports automatically tracking certain things out of the box and supports API's for you to extend that functionality.
To automatically track `page views`, use the following:

```ts
import { Confidence, pageViews } from '@spotify-confidence/sdk';
confidence.track(pageViews());
```

and to automatically track events containing web vitals data, use:

```ts
import { Confidence, webVitals } from '@spotify-confidence/sdk';
confidence.track(webVitals());
```
