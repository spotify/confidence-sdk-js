# React 18 bundle example

Run `yarn install` and `yarn build` at the repository root, then `yarn workspace react18 dev` with `VITE_CONFIDENCE_CLIENT_SECRET` set to a browser-distributable client secret. Vite requires Node 20.19+ or 22.12+.

The example resolves before rendering and demonstrates automatic and manual exposure. Edit the checkout flag paths for your configuration. Do not put a server-only credential in a Vite environment variable. See the [React guide](../../packages/react/README.md) for server-forwarded bundles and server actions.
