import React, { Suspense, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Confidence } from '@spotify-confidence/sdk';
import { ConfidenceProvider, useConfidence, useConfidenceContext, useFlag } from '@spotify-confidence/react';

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

if (!import.meta.env.VITE_CLIENT_SECRET) {
  console.error('VITE_CLIENT_SECRET not set in .env');
}

const confidence = Confidence.create({
  clientSecret: import.meta.env.VITE_CLIENT_SECRET,
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
      <h1>React 19 Example</h1>
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
  const flagValue = useFlag('web-sdk-e2e-flag.str', 'default');
  const flagData = JSON.stringify(flagValue, null, '  ');
  return (
    <fieldset>
      <legend>Flags</legend>
      <ContextControl />
      <pre>{flagData}</pre>
    </fieldset>
  );
}

function ContextControl() {
  const confidence = useConfidence();
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
      <pre>{JSON.stringify(useConfidenceContext())}</pre>
      <button onClick={() => confidence.setContext({ targeting_key: Math.floor(2e6 * Math.random()).toString(16) })}>
        Randomize
      </button>
      <button onClick={toggleTargetingKey}>Toggle</button>
      <button onClick={() => confidence.clearContext()}>Clear</button>
    </fieldset>
  );
}
