# Example of using Confidence in Next13

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

### `yarn dev`

Runs the app in the development mode.

## Pages

### [Next 13 simple](http://localhost:3000/next13Simple)

`http://localhost:3000/next13Simple` \
This is an example of resolving a flag in a Server Component and passing the resolved values to a Client Component.

### [Next 13 Advanced](http://localhost:3000/next13Advanced)

`http://localhost:3000/next13Advanced` \
This is an example of resolving a flag in a Server Component and a simple setup to allow refreshes of the context and
flag resolution executing solely on the client side, using a ClientBoundary.

### [Next 12 Simulation](http://localhost:3000/next12Simulation)

`http://localhost:3000/next12Simulation` \
This is an example of using the Next12 pages router and using getServerSideProps to resolve the flag values and pass
them to the components.

## API

### [Next 13 simple API](http://localhost:3000/next13Simple/api)

`http://localhost:3000/next13Simple/api` \
This is an example of resolving a flag in a simple Next api route.

next12Simulation

### [Next 12 simple API](http://localhost:3000/api/next12Simulation)

`http://localhost:3000/api/next12Simulation` \
This is an example of resolving a flag in a simple Next api route.

#### Note:

You must build the packages first by running `yarn build` at the root of the repository.
