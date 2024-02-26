import JSDOMEnvironment from 'jest-environment-jsdom';

// this is needed to add the node fetch impl. to the JSDOM env.
export default class CustomJestBrowserEnvironment extends JSDOMEnvironment {
  constructor(...args: ConstructorParameters<typeof JSDOMEnvironment>) {
    super(...args);
    this.global.fetch = fetch;
    this.global.Request = Request;
    this.global.Response = Response;
    // And any other missing globals
  }
}
