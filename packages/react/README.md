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

The Confidence React integration has a Provider that needs to be initialized. It accepts a Confidence instance and should wrap your component tree. Here's an example for client-side rendering:

```ts
import { Confidence } from '@spotify-confidence/sdk/';
import { ConfidenceProvider } from '@spotify-confidence/sdk/react';

// Client-side initialization
const confidence = Confidence.create({
  clientSecret: 'mysecret',
  region: 'eu',
  environment: 'client', // Note: For client-side rendering
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

For server-side rendering setup, see the [Server-Side Rendering Support](#server-side-rendering-support) section below.

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

### Server-Side Rendering Support (experimental)

The Confidence React SDK now supports server-side rendering (SSR) and React Server Components (RSC) for instance in Next.js. The SDK provides a separate entry point for server components:

- `@spotify-confidence/react` - For client components
- `@spotify-confidence/react/server` - For server components

When using the SDK in a server environment:

1. Create a Confidence instance for server using the React.cache as the scope in CacheOptions.
2. Provide an accessor for the Confidence instance using `withContext`.
3. Use direct flag evaluation in server components.

Here's an example of how to use Confidence in a Next.js application:

```ts
// app/confidence.ts (Server-side configuration)
import { Confidence } from '@spotify-confidence/sdk';
import React from 'react';

const confidence = Confidence.create({
  clientSecret: process.env.CONFIDENCE_CLIENT_SECRET!,
  environment: 'backend',
  timeout: 1000,
  logger: console,
  cache: {
    scope: React.cache, // Use React.cache for server-side caching
  },
});

// Confidence accessor for use in RSC.
export const getConfidence = (context: Context): Confidence => {
  return confidence.withContext(context);
};

// app/components/ServerComponent.tsx
import { cookies } from 'next/headers';
import { getConfidence } from '../confidence';

export const ServerComponent = async () => {
  const cookieStore = await cookies();
  const targeting_key = cookieStore.get('cnfdVisitorId')?.value; // or a unique targeting value of your choice
  const confidence = getConfidence({ targeting_key });

  // Direct flag evaluation in server components
  const color = await confidence.getFlag('my-feature-flag.color', 'blue');

  return <div style={{ color }}>Server rendered content</div>;
};
```

> [!IMPORTANT]
> Be aware that if you are constructing the Confidence instance using a custom `fetchImplementation` this will only be used on the server side.

#### Server and Client (experimental)

If you also have interactive (client side) components that benefit from feature flagging support.
Using the pattern below in addition to the above server side example will allow you to have the flag evaluations
seamlessly transferred from the server component to the client components.

Please note:

- Server components use direct flag evaluation with `evaluateFlag` or `getFlag`
- Client components use hooks (`useFlag`, `useConfidence`) for interactive features
- Use React.cache for efficient server-side caching
- The SDK automatically handles synchronization from server to client
- Mutating the context in a client side component does not affect the server side confidence instance.

> [!IMPORTANT]
> If your development environment uses TurboPack (e.g., Next.js with Turbopack enabled), please note that the
> Confidence React SDK (server and client) is **not currently supported** with TurboPack. You'll need to use the standard webpack-based build system instead.

```tsx
// app/layout.tsx
import { ConfidenceProvider } from '@spotify-confidence/react/server';
import { getConfidence } from '../confidence';
import { ClientComponent } from 'components/ClientComponent';
import { ServerComponent } from 'components/ServerComponent';

export default async function Layout() {
  const cookieStore = await cookies();
  const targeting_key = cookieStore.get('cnfdVisitorId')?.value;
  const confidence = getConfidence({ targeting_key });

  return (
    <div>
      <ConfidenceProvider confidence={confidence}>
        <Suspense fallback={<h1>Loading...</h1>}>
          <ClientComponent>
            <ServerComponent>
              <ClientComponent />
            </ServerComponent>
          </ClientComponent>
        </Suspense>
      </ConfidenceProvider>
    </div>
  );
}

// app/components/ClientComponent.tsx
('use client');
import { useConfidence, useFlag } from '@spotify-confidence/react/client';

export const ClientComponent = () => {
  // Use hooks in client components
  const confidence = useConfidence();
  const fontSize = useFlag('my-feature-flag.size', 12);

  return (
    <div>
      <div style={{ fontSize }}>Client rendered content</div>
      <button onClick={() => confidence.setContext({ locale: 'sv-SE' })}>Choose Swedish</button>
    </div>
  );
};
```

#### In-depth

Coming soon.

### Tracking events

The event tracking API is available on the Confidence instance as usual. See the [SDK Readme](https://github.com/spotify/confidence-sdk-js/blob/main/packages/sdk/README.md#event-tracking) for details.

```ts
const confidence = useConfidence();
confidence.track('my-event-name', { my_data: 4 });
```
