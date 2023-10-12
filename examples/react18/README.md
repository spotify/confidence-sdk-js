# Example of using Confidence in React 18

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

### `yarn dev`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

#### Note:

You must build the packages first by running `yarn build` at the root of the repository.

## The basics

In `App.tsx` we configure the `Confidence Web Provider` and setup the Context in Openfeature.
We are resolving a string value from a flag and displaying it on the page, the context can be changed by pressing the
button, showing how the SDK reacts to changes of the context.
