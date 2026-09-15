# Confidence React

React 18/19 hooks over an immutable `FlagBundle`. No OpenFeature singleton, client lifecycle, or fetching during render.

```sh
yarn add @spotify-confidence/react@^0.3.0 @spotify-confidence/sdk@^0.5.0
```

## Browser applications

Resolve outside React (or in your application's data-loading layer), then provide the snapshot:

```tsx
import { ConfidenceClient } from '@spotify-confidence/sdk';
import { ConfidenceProvider, useFlag, useFlagDetails } from '@spotify-confidence/react';

const client = new ConfidenceClient({ clientSecret: 'your-browser-client-secret' });
const bundle = await client.resolve(['checkout'], { targeting_key: 'user-123' }, { apply: false });

function Checkout() {
  const enabled = useFlag('checkout.enabled', false);
  return <button disabled={!enabled}>Checkout</button>;
}

// Pass this tree to createRoot(...).render(...).
const app = (
  <ConfidenceProvider bundle={bundle} apply={flag => client.apply(bundle.resolveToken, flag)}>
    <Checkout />
  </ConfidenceProvider>
);
```

Only use credentials intended for browser distribution here. For server-only credentials, resolve on the server and supply an exposure callback that calls your server.

`useFlag` exposes after React commits the component. For conditional usage:

```tsx
const { value, reason, errorCode, expose } = useFlagDetails('checkout.enabled', false, { expose: false });
// Call when the feature is actually used; handle delivery failures.
const onClick = () => {
  void expose().catch(console.error);
};
```

Exposure is deduplicated by base flag name within each provider snapshot, including concurrent calls, multiple dot paths, and StrictMode effects. Failed writes can be retried by calling `expose()` again. Automatic failures call `onExposureError` (or `console.warn`); there is no automatic retry loop. An `apply` callback may return `void`, a promise, or the thin client's `{ ok, errorMessage }` result. It must throw/reject or return `ok: false` to report failure.

Missing providers, missing flags, resolution failures, and type mismatches return defaults without exposure. An already-applied assignment (`shouldApply: false`) still reports its variant to browser developer tooling without sending another apply request.

## Server rendering and server actions

The provider and hooks work with server-forwarded JSON and hydrate using the same snapshot. The React package has no `/server` entry point: application loaders/server components own resolution and transport.

```tsx
// app/page.tsx — an application-owned server component
import { ConfidenceClient } from '@spotify-confidence/sdk';
import { ConfidenceProvider } from '@spotify-confidence/react';
import { Checkout } from './Checkout'; // a client component using useFlag

export default async function Page() {
  const client = new ConfidenceClient({ clientSecret: process.env.CONFIDENCE_CLIENT_SECRET! });
  // Derive context from the authenticated request in your application.
  const bundle = await client.resolve(['checkout'], { targeting_key: 'user-123' }, { apply: false });
  const token = bundle.resolveToken;

  async function apply(flag: string) {
    'use server';
    const serverClient = new ConfidenceClient({ clientSecret: process.env.CONFIDENCE_CLIENT_SECRET! });
    return serverClient.apply(token, flag);
  }

  return (
    <ConfidenceProvider bundle={{ ...bundle, resolveToken: '' }} apply={apply}>
      <Checkout />
    </ConfidenceProvider>
  );
}
```

Keep tokens on the server when using server-side resolution: local-resolver tokens may contain targeting context. Secure exposure endpoints/actions using your application's authorization and rate limiting, and bind them to the original token. Outside an RSC framework, send the token-free bundle with the page and provide a browser callback to your own exposure endpoint.

For the local resolver, the same client provider accepts its bundle and a callback bound to `provider.applyFlag(bundle.resolveToken, flag)`. Its existing server wrapper can retain that action while switching its client provider to this package. The shared evaluator accepts local materialization and provider error reasons; replacing the separate repository's imports is follow-up work. This does not imply tokens can be applied through a different resolver backend.

## Context changes

Bundles are immutable snapshots, not live clients. Resolve again when context changes and pass the new bundle with its corresponding `apply` callback. A new bundle object starts a new exposure scope; preserve its identity during ordinary rerenders. Cancel or discard stale resolve requests in your data-loading layer, and avoid rendering an old user's snapshot while loading a new one.

## Migrating from 0.2

Replace the old `confidence` provider prop with `bundle` and `apply`. Replace legacy flag hooks with `useFlag` / `useFlagDetails`; the latter returns `FlagBundle.Details` plus async `expose()`, not OpenFeature evaluation details. Resolve before rendering instead of relying on the old client's subscriptions or suspense behavior. The old server helpers and Next.js development patch are removed. Upgrade React integration to `0.3` together with SDK `0.5`.
