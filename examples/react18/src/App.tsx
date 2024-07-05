import React, { Suspense, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Confidence, pageViews } from '@spotify-confidence/sdk';
import { ConfidenceProvider, ConfidenceReact, useConfidence } from '@spotify-confidence/react';

const state = {
  get failRequests(): boolean {
    return document.location.hash === '#fail';
  },
  set failRequests(value: boolean) {
    document.location.hash = value ? '#fail' : '';
  },
};

const handleFailRequestsOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  state.failRequests = e.target.checked;
};

if (!process.env.REACT_APP_CLIENT_SECRET) {
  console.error('REACT_APP_CLIENT_SECRET not set in .env');
  process.exit(1);
}

const confidence = Confidence.create({
  clientSecret: process.env.REACT_APP_CLIENT_SECRET,
  environment: 'client',
  timeout: 3000,
  logger: console,
  fetchImplementation: (req: Request) => {
    console.log('request', req.url);
    return state.failRequests ? Promise.resolve(new Response(null, { status: 500 })) : fetch(req);
  },
});

function App() {
  const Fallback = (): React.ReactElement => {
    const toggleBoundary = useContext(boundaryContext);
    useEffect(() => {
      console.log('mounted fallback');
      // toggleBoundary(false);
    });
    return <p>Loading...</p>;
  };
  return (
    <ConfidenceProvider confidence={confidence}>
      <h1>React 18 Example</h1>
      <label>
        <input type="checkbox" defaultChecked={state.failRequests} onChange={handleFailRequestsOnChange} /> Fail
        requests.
      </label>

      <Suspense fallback="App loading...">
        <Level name="Outer">
          <Suspense fallback="Outer loading...">
            <Boundary>
              <Suspense fallback={<Fallback />}>
                <Level name="Inner">
                  <Flags />
                </Level>
              </Suspense>
            </Boundary>
          </Suspense>
        </Level>
        <button onClick={() => confidence.evictFlagCache()}>Evict Cache</button>
      </Suspense>
    </ConfidenceProvider>
  );
}

export default App;

const boundaryContext = createContext((toggle: boolean): void => {
  throw new Error();
});
function Boundary({ children }: { children?: React.ReactNode }) {
  const [boundaryState, setBoundaryState] = useState(true);
  return <boundaryContext.Provider value={setBoundaryState}>{boundaryState && children}</boundaryContext.Provider>;
}
function Level({ name, children }: { name: string; children?: React.ReactNode }) {
  const [count, setCount] = React.useState(0);
  console.log('render', name, count);
  const confidence = useConfidence();
  return (
    <fieldset>
      <legend>Level {name}</legend>
      <div>
        <ContextControl />
      </div>
      <div>
        <ConfidenceProvider.WithContext context={{ level: name }}>{children}</ConfidenceProvider.WithContext>
      </div>
      <button onClick={() => setCount(value => value + 1)}>Rerender</button>
    </fieldset>
  );
}

function Flags() {
  const confidence = useConfidence();
  const flagData = JSON.stringify(confidence.useEvaluateFlag('tutorial-feature.title', 'Default'), null, '  ');
  // const flagData = useDeferredValue(confidence.useFlag('web-sdk-e2e-flag.str', 'default'));
  return (
    <fieldset>
      <legend>Flags</legend>
      <ContextControl />
      <pre>{flagData}</pre>
    </fieldset>
  );
}

function ContextControl() {
  // const name = String(confidence.getContext().level ?? '');
  const confidence = useConfidence();
  // const [isPending, startTransition] = useTransition();
  // const setContext = (value: Context) => startTransition(() => confidence.setContext(value));
  const toggleTargetingKey = useCallback(() => {
    let { targeting_key } = confidence.getContext();
    if (targeting_key === 'user-a') {
      targeting_key = 'user-b';
    } else {
      targeting_key = 'user-a';
    }
    confidence.setContext({ targeting_key });
  }, [confidence]);

  return (
    <fieldset>
      <legend>Context</legend>
      <pre>{JSON.stringify(confidence.useContext())}</pre>
      <button onClick={() => confidence.setContext({ targeting_key: Math.floor(2e6 * Math.random()).toString(16) })}>
        Randomize
      </button>
      <button onClick={toggleTargetingKey}>Toggle</button>
      <button onClick={() => confidence.clearContext()}>Clear</button>
    </fieldset>
  );
}
