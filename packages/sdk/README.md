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
  environment: 'client', // or 'backend'
  timeout: 1000,
});
```

### Region

The region option is used to set the region for the network request to the Confidence backend. When the region is not set, the default (global) region will be used.
The current regions are: `eu` and `us`.

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

> [!IMPORTANT]
> When using the SDK in a server environment, you should call `withContext` rather than `setContext`. This will give you a new instance scoped to the request and prevent context from leaking between requests.

## Accessing flags

Flags can be accessed with two different API's.

The flag value API returns the Confidence assigned flag value or the passed in default value if no value was returned.
The evaluate API returns a `FlagEvaluation` type that also contain information about `variant`, `reason` and possible error details.

```ts
const flag = await confidence.getFlag('tutorial-feature', {});
const flagEvaluation = await confidence.evaluateFlag('tutorial-feature', {});
```

### Dot notation

Both the "flag value", and the "evaluate" API's support dot notation, meaning that if the Confidence flag has a property `enabled` or `title` on the flag, you can access them directly:

```ts
const enabled = await confidence.getFlag('tutorial-feature.enabled', false);
const messageEvaluation = await confidence.evaluateFlag('tutorial-feature.message', 'default message');
const message = messageEvaluation.value;
```

### Synchronous access

In a client application (where `environment` is set to `client`), the SDK fetches and caches all flags when the context is updated. This means the flags can be accessed synchronously after that.

## Event tracking

Use `confidence.track()` from any Confidence instance to track an event in Confidence. Any context data set on the instance will be appended to the tracking event.

```ts
confidence.track('event_name', { 'message-detail1': 'something interesting' });
```

### Auto track

Confidence supports automatically tracking certain things out of the box and supports API's for you to extend that functionality.

#### Visitor ID (web)

Confidence can provide all flag resolves and tracking events with a browser specific identifier. We call this `visitor_id`.  
The `visitor_id` is stored in a cookie. To add a generated `visitor_id` to the context, use the following:

```ts
import { visitorIdentity } from './trackers';
confidence.track(visitorIdentity());
```

#### Page Views (web)

Confidence can automatically track `page views` on events such as `load`, `pushState`, `replaceState`, `popstate` and `hashchange`.
To automatically track `page views`, use the following:

```ts
import { Confidence, pageViews } from '@spotify-confidence/sdk';
confidence.track(pageViews());
```

#### Web vitals (web)

To automatically send tracking events containing [web vitals data](https://web.dev/articles/vitals), use:

```ts
import { Confidence, webVitals } from '@spotify-confidence/sdk';
confidence.track(webVitals());
```
