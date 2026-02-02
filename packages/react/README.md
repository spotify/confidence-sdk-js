# Confidence React SDK

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

> [!NOTE]
> This Confidence standalone React SDK is being phased out. For new integrations, we recommend using the OpenFeature APIs directly:
>
> - **Client SPA**: Use the [OpenFeature React SDK](https://openfeature.dev/docs/reference/sdks/client/web/react/) with our [@spotify-confidence/openfeature-web-provider](https://github.com/spotify/confidence-sdk-js/blob/main/packages/openfeature-web-provider/README.md)
> - **SSR (e.g., Next.js)**: Resolve all flags server-side using [@spotify-confidence/openfeature-server-provider-local](https://github.com/spotify/confidence-resolver/tree/main/openfeature-provider/js/README.md) and propagate values to the client. This gives optimal performance, avoids the complexity of managing context across the client/server boundary, and keeps flag logic and sensitive context data securely private.

This package contains helper functionality to make the Confidence SDK work well in a React environment. **Note:** This package is only relevant if you are using the Confidence SDK directly. If you are using OpenFeature, please use the [OpenFeature React SDK](https://github.com/open-feature/js-sdk/tree/main/packages/react-sdk) instead.

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

## Server-Side Rendering (experimental)

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

### Server and Client (experimental)

If you also have interactive (client-side) components that benefit from feature flagging support, you can use the pattern below together with the server-side approach described above.
This allows flag evaluations to be seamlessly transferred from server components to client components.

Please note:

- Server components use direct flag evaluation with `evaluateFlag` or `getFlag`
- Client components use hooks (`useFlag`, `useConfidence`) for interactive features
- Use React.cache for efficient server-side caching
- The SDK automatically handles synchronization from server to client
- Mutating the context in a client side component does not affect the server side confidence instance.

> [!IMPORTANT]
> Be aware that if you are constructing the Confidence instance using a custom `fetchImplementation` this will only be used on the server side. Client side the SDK will use the default `fetch` implementation.

> [!IMPORTANT]
> Combined server and client support currently doesn't work well in Next.js dev mode with Turbopack enabled.
> This is due to a number of open bugs in Turbopack. We'll soon provide a list with the specific issues to track progress.
> In the meantime you can opt out of using Turbopack by making sure the `dev` script in your `package.json` is just `next dev`, and not `next dev --turbopack`.

```tsx
// app/layout.tsx
import { ConfidenceProvider } from '@spotify-confidence/react/server';
import { getConfidence } from '../confidence';
import { ClientComponent } from 'components/ClientComponent';
import { ServerComponent } from 'components/ServerComponent';

export default async function Layout() {
  const confidence = await getConfidence();

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
  const fontSize = useFlag('my-feature-flag.size', '12pt');

  return (
    <div>
      <div style={{ fontSize }}>Client rendered content</div>
      <button onClick={() => confidence.setContext({ locale: 'sv-SE' })}>Choose Swedish</button>
    </div>
  );
};
```

## Example Application

For a more extensive example application, see the [confidence-sdk-demos](https://github.com/spotify/confidence-sdk-demos) repository.

## Tracking events

The event tracking API is available on the Confidence instance as usual. See the [SDK Readme](https://github.com/spotify/confidence-sdk-js/blob/main/packages/sdk/README.md#event-tracking) for details.

```ts
const confidence = useConfidence();
confidence.track('my-event-name', { my_data: 4 });
```
