# Confidence React SDK

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

This package contains helper functionality to make the Confidence SDK work well in a React environment.

# Usage

## Adding the dependencies

To add the packages to your dependencies run:

```sh
yarn add @spotify-confidence/react
```

## Initializing the ConfidenceProvider

The Confidence React integration has a Provider that needs to be initialized. It accepts a Confidence instance and should wrap your component tree. Here's an example for client-side rendering:

```ts
import { Confidence } from '@spotify-confidence/sdk/';
import { ConfidenceProvider } from '@spotify-confidence/react';

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

## Managing context

The `ConfidenceProvider` API supports a `useWithContext()` hook to achieve the [standard context API](https://github.com/spotify/confidence-sdk-js/blob/main/packages/sdk/README.md#setting-the-context).

## Accessing flags

Flags are accessed with a set of hooks exported from `@spotify-confidence/react`:

```ts
import { useFlag, useEvaluateFlag } from '@spotify-confidence/react';

function MyComponent() {
  // Simple flag access - returns the flag value or default
  const color = useFlag('my-feature-flag.color', 'blue');

  // Detailed flag evaluation - returns evaluation details
  const { value, reason } = useEvaluateFlag('my-feature-flag.size', 12);

  return (
    <div style={{ color, fontSize: value }}>
      <p>Color: {color}</p>
      <p>Size: {value}</p>
      <p>Reason: {reason}</p>
    </div>
  );
}
```

### Hook Behavior

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

### Important Notes

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

## Server-Side Rendering
For applications using SSR frameworks such as [Next.js](https://nextjs.org/docs), feature flags can be fetched on the server using the [web sdk](packages/sdk/README.md) `@spotify-confidence/sdk` and resolved values can be passed down to client components. Flag fetching can be user-specific by using `withContext()` (to avoid mutating a globally shared Confidence instance) and loading the user context from cookies, headers, or the request object. If many client components need the same flag, consider using a Context Provider to avoid prop drilling and centralize flag access.


### Using Flags in a Server Component
When using the SDK in a server environment:

1. Create a global Confidence instance for the server using React.cache as the scope in CacheOptions.
2. Whenever accessing flags in server components, use `withContext` to provide the context for the flag evaluation. Like shown in the example below you can simplify this by using a `getConfidence` helper function exported from the same file where you configure the Confidence instance.
3. Use direct flag evaluation with `await` in server components.
```ts
// app/confidence.ts (Server-side configuration)
import { Confidence } from '@spotify-confidence/sdk';
import { cookies } from 'next/headers';

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

export async function getConfidence() {
  const cookieStore = await cookies();
  const targeting_key = cookieStore.get('visitorId')?.value; // a unique targeting value of your choice

  return confidence.withContext({ targeting_key });
}
```
```tsx
// app/components/ServerComponent.tsx
import { getConfidence } from '../confidence';

export const ServerComponent = async () => {
  const confidence = await getConfidence();

  // Direct flag evaluation in server components
  const color = await confidence.getFlag('my-feature-flag.color', 'blue');

  return <div style={{ color }}>Server rendered content</div>;
};
```

### Using Flags in a Client Component

```tsx
// app/components/ClientComponent.tsx
'use client';

type ClientComponentProps = {
  color: string;
};

export default function ClientComponent({ color }: ClientComponentProps) {
  return <div style={{ color }}>Client rendered content</div>;
}
```

```tsx
// app/components/ServerComponent.tsx
import { getConfidence } from '../confidence';
import ClientComponent from './ClientComponent';

export default async function ServerComponent() {
  const confidence = await getConfidence();

  // Fetch the flag value server-side with user context
  const color = await confidence.getFlag('my-feature-flag.color', 'blue');

  // Pass the flag value as a prop to the client component
  return <ClientComponent color={color} />;
}
```

## Example Application
For a more extensive example application, see the [confidence-sdk-demos](https://github.com/spotify/confidence-sdk-demos) repository.


## Tracking events

The event tracking API is available on the Confidence instance as usual. See the [SDK Readme](https://github.com/spotify/confidence-sdk-js/blob/main/packages/sdk/README.md#event-tracking) for details.

```ts
const confidence = useConfidence();
confidence.track('my-event-name', { my_data: 4 });
```
