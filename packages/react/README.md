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

Anywhere in the sub-tree under the `ConfidenceProvider` you can now access the confidence instance with the `useConfidence()` hook to access context modification API's. For flag resolves we suggest using `useFlag()`.

### Managing context

The `ConfidenceProvider` API supports a `useWithContext()` hook to achieve the [standard context API](https://github.com/spotify/confidence-sdk-js/blob/main/packages/sdk/README.md#setting-the-context).

### Accessing flags

Flags are accessed with a set of hooks exported from `@spotify-confidence/react`:

```ts
import { useFlag, useEvaluateFlag } from '@spotify-confidence/react';

function MyComponent() {
  // Simple flag access - returns the flag value or default
  const color = useFlag('my-feature-flag.color', 'blue');

  // Detailed flag evaluation - returns evaluation details
  const { value, reason, context } = useEvaluateFlag('my-feature-flag.size', 12);

  return (
    <div style={{ color, fontSize: value }}>
      <p>Color: {color}</p>
      <p>Size: {value}</p>
      <p>Reason: {reason}</p>
    </div>
  );
}
```

#### Hook Behavior

- `useFlag(flagName, defaultValue)`

  - Returns the flag value or default
  - Simplest way to access flag values
  - Type-safe with TypeScript
  - Example: `const isEnabled = useFlag('feature.enabled', false)`

- `useEvaluateFlag(flagName, defaultValue)`
  - Returns an object with:
    - `value`: The flag value or default
    - `reason`: The evaluation reason (e.g., "DEFAULT", "TARGETING_MATCH")
    - `variant`: The variant assigned
  - Useful for debugging or when you need evaluation details
  - Example: `const { value, reason } = useEvaluateFlag('feature.color', 'blue')`

#### Important Notes

1. **Suspense Integration**

   - Both hooks integrate with React Suspense
   - Wrap components using these hooks in a Suspense boundary
   - Example:

   ```tsx
   <Suspense fallback={<LoadingSpinner />}>
     <MyComponent />
   </Suspense>
   ```

2. **Reactivity**

   - Hooks automatically re-render when context changes
   - No need to manually trigger updates
   - Example:

   ```tsx
   function MyComponent() {
     const confidence = useConfidence();
     const theme = useFlag('app.theme', 'light');

     return <button onClick={() => confidence.setContext({ user_type: 'premium' })}>Switch to Premium</button>;
   }
   ```

3. **Type Safety**
   - Both hooks are fully typed with TypeScript
   - The return type matches the default value type
   - Example:
   ```ts
   const count: number = useFlag('counter.value', 0);
   const name: string = useFlag('user.name', '');
   ```

### Server-Side Rendering Support (experimental)

The Confidence React SDK now supports server-side rendering (SSR) and React Server Components (RSC) for instance in Next.js. The SDK provides a separate entry point for server components:

- `@spotify-confidence/react` - For client components
- `@spotify-confidence/react/server` - For server components

When using the SDK in a server environment:

1. Create a Confidence instance for server using the React.cache as the scope in CacheOptions.
2. Optionally provide an accessor for the Confidence instance using `withContext` so you don't need to do that in every place.
3. Use direct flag evaluation in server components.

Here's an example of how to use Confidence in a Next.js application:

```ts
// app/confidence.ts (Server-side configuration)
import { Confidence } from '@spotify-confidence/sdk';
import React from 'react';

export const confidence = Confidence.create({
  clientSecret: process.env.CONFIDENCE_CLIENT_SECRET!,
  environment: 'backend',
  timeout: 1000,
  logger: console,
  cache: {
    scope: React.cache, // Use React.cache for server-side caching
  },
});

// app/components/ServerComponent.tsx
import { cookies } from 'next/headers';
import { confidence } from '../confidence';

export const ServerComponent = async () => {
  const cookieStore = await cookies();
  const targeting_key = cookieStore.get('cnfdVisitorId')?.value; // or a unique targeting value of your choice

  // Direct flag evaluation in server components
  const color = await confidence.withContext({ targeting_key }).getFlag('my-feature-flag.color', 'blue');

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
