import React, { Suspense, useCallback } from 'react';
import TestComponent from './TestComponent';
import { Confidence, pageViews } from '@spotify-confidence/sdk';
import { ConfidenceProvider, ConfidenceReact, useConfidence } from '@spotify-confidence/react';
import { Contextual } from '@spotify-confidence/sdk';

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

const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  environment: 'client',
  timeout: 5000,
  logger: console,
  fetchImplementation: (req: Request) => {
    console.log('request', req.url);
    return state.failRequests ? Promise.resolve(new Response(null, { status: 500 })) : fetch(req);
  },
});

// confidence.track(pageViews());

function App() {
  return (
    <ConfidenceProvider confidence={confidence}>
      <h1>React 18 Example</h1>
      <label>
        <input type="checkbox" defaultChecked={state.failRequests} onChange={handleFailRequestsOnChange} /> Fail
        requests.
      </label>

      <Suspense fallback="App loading...">
        <Outer />
      </Suspense>
    </ConfidenceProvider>
  );
}

export default App;

function Outer() {
  console.log('Outer render', performance.now());
  return (
    <fieldset>
      <legend>Outer</legend>
      <div>
        <ContextControl confidence={useConfidence()} />
      </div>
      <div>
        <React.Suspense fallback="Outer loading...">
          <ConfidenceProvider.WithContext context={{ name: 'inner' }}>
            <Inner />
          </ConfidenceProvider.WithContext>
        </React.Suspense>
      </div>
    </fieldset>
  );
}

function Inner() {
  const [count, setCount] = React.useState(0);
  console.log('Inner render', count, performance.now());

  return (
    <fieldset>
      <legend>Inner</legend>
      <ContextControl confidence={useConfidence()} />
      <fieldset>
        <legend>Flags</legend>
        <pre>{JSON.stringify(useConfidence().useEvaluateFlag('web-sdk-e2e-flag.str', 'default'), null, '  ')}</pre>
      </fieldset>
      <button onClick={() => setCount(value => value + 1)}>Rerender</button>
    </fieldset>
  );
}
function ContextControl({ confidence }: { confidence: Contextual<any> }) {
  const name = String(confidence.getContext().name ?? '');
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
      <legend>Context {name}</legend>
      <pre>{JSON.stringify(confidence.getContext())}</pre>
      <button onClick={() => confidence.setContext({ targeting_key: Math.floor(2e6 * Math.random()).toString(16) })}>
        Randomize
      </button>
      <button onClick={toggleTargetingKey}>Toggle</button>
      <button onClick={() => confidence.clearContext()}>Clear</button>
    </fieldset>
  );
}
