# OpenFeature Web SDK Next Integration

![](https://img.shields.io/badge/lifecycle-beta-a0c3d2.svg)

This is a helper package to use `OpenFeature` in Next. It is not official OpenFeature.

# Usage

## Adding the dependencies

To add the packages to your dependencies run:

```sh
yarn add @openfeature/web-sdk @openfeature/js-sdk @spotify-confidence/openfeature-web-provider @spotify-confidence/openfeature-server-provider @spotify-confidence/integration-next
```

In general for Next.js we want to utilise the dynamic paradigm from OpenFeature for backend flag evaluations, and the
static paradigm for browser side flag evaluations. We require you to have setup a client and a server provider in your
application, see the respective docs on how to do this for [web](../openfeature-web-provider/README.md) and [server](../openfeature-server-provider/README.md).

## Next 13

For Next 13 we can utilize the dynamic paradigm in server components, so the server side setup is very simple:

```tsx
import { OpenFeature } from '@openfeature/js-sdk';

const client = OpenFeature.getClient();

export async function AServerComponent() {
  const somestring = await client.getStringValue('flagKey', 'default', { targetingKey: 'user-a' });

  return <p>{someString}</p>;
}
```

For the client components we need to setup the OpenFeature global, we have a component to do this for you.

```tsx
/// ClientComponent file
'use client'

import {useStringValue} from "@spotify-confidence/integration-next";

export function ClientComponent() {
    const str = useStringValue('flagKey', 'default')
    return <p>{str}</p>
}

// App file
import {createConfidenceServerProvider} from "@spotify-confidence/openfeature-server-provider";
import { OpenFeatureNext13 } from '@spotify-confidence/integration-next';

const serverProvider = createConfidenceServerProvider(...);

export function App() {
    return (
        <>
            <OpenFeatureNext13.ClientSetup
                serialized={serverProvider.serialize()}
                context={{
                    targetingKey: 'user-a'
                }}
                clientProvider={clientProvider}
            />
            <React.Suspense fallback={<Fallback/>}>
                <ClientComponent/>
            </React.Suspense>
        </>
    )
}
```

## Next 12

Next 12 allows works a little differently, you still want to be able to utilise the dynamic paradigm in the getServerSide props, but we need to
ensure all component code is the same on the client and the server, we do this with a wrapper, which contains Suspense. Which also configures
the OpenFeature global on the web side.

```tsx
import React from 'react';
import { OpenFeature } from '@openfeature/js-sdk';
import { serverProvider } from '@/app/utils/ConfidenceServer';
import OLDStringFromClient from '@/components/OLDStringFromClient';
import { PagesSetupAndTopLevelSuspense } from '@spotify-confidence/integration-next';
import { clientProvider } from '@/app/utils/ConfidenceClient';
import { OpenFeatureNext12 } from '@spotify-confidence/integration-next';

function TestComponent() {
  const str = useStringValue('flagKey', 'default');
  return <p>{str}</p>;
}

export default function Old(props: any) {
  const { seralizedConfig } = props;

  return (
    <OpenFeatureNext12.ClientSetup
      clientProvider={clientProvider}
      context={{ targetingKey: 'user-a' }}
      serialziedConfig={seralizedConfig}
      fallback={<Fallback />}
    >
      <TestComponent />
    </OpenFeatureNext12.ClientSetup>
  );
}

export async function getServerSideProps() {
  OpenFeature.setProvider(serverProvider);

  const fromSSP = await OpenFeature.getClient().getBooleanValue('web-sdk-e2e-flag.bool', true, {
    targetingKey: 'user-a',
  });

  return { props: { seralizedConfig: serverProvider.serialize() } };
}
```

### Known limitations

- flags must be resolved in the backend as well as in the frontend

Notes:

- `React.Suspense` is used to show users a loading state whilst the flags are pending, to limit flickering experiences for users.
- If the context is changed after a render, the app will not refresh until the resolve is complete, the web page will only update once, with the new flag values.

# Hooks For Client Components / Next 12

This library re-exposes the React hooks in the `@spotify-confidence/integration-react` package, all the hooks available
[here](../integration-react/README.md) can be used
