# Confidence React SDK

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

This package contains helper functionality to make the Confidence SDK work well in a React environment.

## Usage

### Adding the dependencies

To add the packages to your dependencies run:

```sh
yarn add @spotify-confidence/react
```

### Initializing the ConfidenceProvider

The Confidence React integration has a Provider that needs to be initialized. It accepts a Confidence instance and should wrap your component tree.

```ts
import { Confidence } from '@spotify-confidence/sdk';

const confidence = Confidence.create({
  clientSecret: 'mysecret',
  region: 'eu',
  environment: 'client',
  timeout: 1000,
});

function App() {
  return (
    <ConfidenceProvider confidence={confidence}>
      <React.Suspense fallback={<p>Loading... </p>}>
        <MyComponent />
      </React.Suspense>
    </ConfidenceProvider>
  );
}
```

### Managing context

The `useConfidence()` hook supports the [standard context API's](https://github.com/spotify/confidence-sdk-js/blob/main/packages/sdk/README.md#setting-the-context). Additionally, the following wrapper component can be used to wrap a sub tree with additional context data.

```ts
<ConfidenceProvider.WithContext context={{ user_name: 'John Doe' }}>
  <UserDetails />
</ConfidenceProvider.WithContext>
```

### Accessing flags

Flags are accessed with a set of hooks exported from `@spotify-confidence/react`

- `useFlag(flagName, defaultValue)` will return the flag value or default.
- `useEvaluateFlag(flagName, defaultValue)` will return more details about the flag evaluation, together with the value

Both of the flag hooks integrate with the React Suspense API so that the suspense fallback will be visible until flag values are available. It is therefore important to wrap .

Accessing flags will always attempt to provide a up to date value for the flag within the defined timeout, or else default values.

### Tracking events

The event tracking API is available on the Confidence instance as usual. See the [SDK Readme](https://github.com/spotify/confidence-sdk-js/blob/main/packages/sdk/README.md#event-tracking) for details.

```ts
const confidence = useConfidence();
confidence.track('my-event-name', { my_data: 4 });
```
