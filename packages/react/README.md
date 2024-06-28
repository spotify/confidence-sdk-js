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

Anywhere in the sub-tree under the `ConfidenceProvider` you can now access the confidence instance with the `useConfidence()` hook. The hook actually returns an instance of `ConfidenceReact` which is a wrapper around the normal `Confidence` API with some slight adaptations to integrate better with React. You can read more about the differences in the following sections.

### Managing context

The `ConfidenceReact` instance supports the [standard context API](https://github.com/spotify/confidence-sdk-js/blob/main/packages/sdk/README.md#setting-the-context). Additionally, the following wrapper component can be used to wrap a sub tree with additional context data.

```ts
<ConfidenceProvider.WithContext context={{ user_name: 'John Doe' }}>
  <UserDetails />
</ConfidenceProvider.WithContext>
```

### Accessing flags

Flags are accessed with a set of hooks exported from `@spotify-confidence/react`

- `useFlag(flagName, defaultValue)` will return the flag value or default.
- `useEvaluateFlag(flagName, defaultValue)` will return more details about the flag evaluation, together with the value.

Alternatively the `ConfidenceReact` instance has the same hooks as methods on the instance itself, remember though, that these instance methods are hooks and the normal rules for hooks apply.

Both of the flag hooks integrate with the React Suspense API so that the suspense fallback will be shown until flag values are available. It is therefore important to wrap any component using the above hooks in a suspense boundary.

The hooks are also reactive so that if the context changes, any components using the hooks will be re-rendered. As dependent components are re-rendered as soon as the context changes, one might expect that would again trigger the suspense boundary while the flag values are resolved. That is normally not the case however as the `ConfidenceReact.setContext` method is by default wrapped in a React [Transition](https://react.dev/reference/react/startTransition). If you would rather manage the transition logic yourself (with for example [React.useTransition()](https://react.dev/reference/react/useTransition)), or if you want to always trigger a suspense fallback to never show stale values, you can turn off the default behavior by calling `ConfidenceReact.setContext({...}, { transition:false })`.

If the hooks can't resolve the flag values withing the timeout specified on the Confidence instance, they will instead return the default value.

### Tracking events

The event tracking API is available on the Confidence instance as usual. See the [SDK Readme](https://github.com/spotify/confidence-sdk-js/blob/main/packages/sdk/README.md#event-tracking) for details.

```ts
const confidence = useConfidence();
confidence.track('my-event-name', { my_data: 4 });
```
