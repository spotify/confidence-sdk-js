import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { Confidence } from '@spotify-confidence/sdk';
import { ConfidenceProvider, useConfidence, useFlag, useEvaluateFlag } from '@spotify-confidence/react';

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

// Get the client secret from Vite env
const clientSecret = import.meta.env.VITE_CLIENT_SECRET;
if (!clientSecret) {
  throw new Error('VITE_CLIENT_SECRET not set in .env');
}

// Create the Confidence instance
const confidence = Confidence.create({
  clientSecret,
  environment: 'client',
  timeout: 3000,
  logger: console,
  // eslint-disable-next-line no-console
  fetchImplementation: (req: Request) => {
    // eslint-disable-next-line no-console
    console.log('request', req.url);
    return state.failRequests ? Promise.resolve(new Response(null, { status: 500 })) : fetch(req);
  },
});

// ErrorBoundary component to catch and display errors
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: 'red', padding: 24, fontFamily: 'sans-serif' }}>
          <h2>Something went wrong</h2>
          <pre style={{ background: '#f6f8fa', padding: 8 }}>{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * This app demonstrates the main features of the Confidence SDK React integration:
 * - useFlag: Get a flag value reactively
 * - useEvaluateFlag: Get a flag value with evaluation details
 * - ConfidenceProvider.WithContext: Provide context to a subtree
 * - Adding context information (targeting_key, level)
 * - Toggling between user-a and user-b as targeting_key
 */
function App() {
  // State for toggling between user-a and user-b
  const [targetingKey, setTargetingKey] = useState('user-a');
  // State for adding a custom context value
  const [customLevel, setCustomLevel] = useState('Outer');

  // Toggle between user-a and user-b
  const toggleTargetingKey = useCallback(() => {
    setTargetingKey(prev => (prev === 'user-a' ? 'user-b' : 'user-a'));
  }, []);

  return (
    <ErrorBoundary>
      <ConfidenceProvider confidence={confidence}>
        <Suspense fallback="Loading Confidence SDK...">
          <ConfidenceDemo
            targetingKey={targetingKey}
            customLevel={customLevel}
            setCustomLevel={setCustomLevel}
            toggleTargetingKey={toggleTargetingKey}
          />
        </Suspense>
      </ConfidenceProvider>
    </ErrorBoundary>
  );
}

interface ConfidenceDemoProps {
  targetingKey: string;
  customLevel: string;
  setCustomLevel: React.Dispatch<React.SetStateAction<string>>;
  toggleTargetingKey: () => void;
}
function ConfidenceDemo({ targetingKey, customLevel, setCustomLevel, toggleTargetingKey }: ConfidenceDemoProps) {
  // All Confidence hooks and context logic are now inside the provider
  const confidenceInstance = useConfidence();
  useEffect(() => {
    confidenceInstance.setContext({ targeting_key: targetingKey });
  }, [targetingKey, customLevel, confidenceInstance]);

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h1>Confidence React 19 Example</h1>
      <p>
        This example demonstrates the main features of the Confidence SDK React integration. See code comments for more
        details.
      </p>
      <hr />
      <section>
        <h2>
          1. <code>useFlag</code> hook
        </h2>
        <p>
          <b>useFlag</b> returns the value of a feature flag and updates reactively when the flag or context changes.
        </p>
        <pre style={{ background: '#f6f8fa', padding: 8 }}>
          {`const flagValue = useFlag('web-sdk-e2e-flag.str', 'default');`}
        </pre>
        <React.Suspense fallback={<span>Loading flag value...</span>}>
          <FlagValueDisplay />
        </React.Suspense>
      </section>
      <section>
        <h2>
          2. <code>useEvaluateFlag</code> hook
        </h2>
        <p>
          <b>useEvaluateFlag</b> returns the value and evaluation details (reason, variant, etc) for a flag.
        </p>
        <pre style={{ background: '#f6f8fa', padding: 8 }}>
          {`const flagEval = useEvaluateFlag('web-sdk-e2e-flag.str', 'default');`}
        </pre>
        <React.Suspense fallback={<span>Loading evaluation details...</span>}>
          <FlagEvalDisplay />
        </React.Suspense>
      </section>
      <section>
        <h2>3. Context: targeting_key (user-a/user-b)</h2>
        <p>
          The <b>targeting_key</b> is used to simulate different users. Toggle between <b>user-a</b> and <b>user-b</b>{' '}
          to see how the flag value changes.
        </p>
        <div style={{ marginBottom: 12 }}>
          <button onClick={toggleTargetingKey}>Toggle targeting_key (current: {targetingKey})</button>
        </div>
        <div>
          <b>Current context:</b>
          <pre style={{ background: '#f6f8fa', padding: 8 }}>
            {JSON.stringify(confidenceInstance.getContext(), null, 2)}
          </pre>
        </div>
      </section>
      <section>
        <h2>
          4. <code>ConfidenceProvider.WithContext</code>
        </h2>
        <p>
          <b>WithContext</b> allows you to provide additional context to a subtree. Here, we set <code>level</code> to{' '}
          <b>{customLevel}</b> for the inner section only.
        </p>
        <div style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12 }}>
          <button onClick={() => setCustomLevel((l: string) => (l === 'Outer' ? 'Inner' : 'Outer'))}>
            Toggle custom level (current: {customLevel})
          </button>
          <ConfidenceProvider.WithContext context={{ level: customLevel }}>
            <React.Suspense fallback={<span>Loading inner flags...</span>}>
              <InnerFlags />
            </React.Suspense>
          </ConfidenceProvider.WithContext>
        </div>
      </section>
      <section>
        <h2>5. Tracking events</h2>
        <p>
          Use <code>confidence.track(eventName, payload)</code> to emit a custom tracking event. The current context
          will be attached automatically.
        </p>
        <TrackEventDemo confidence={confidenceInstance} />
      </section>
    </main>
  );
}

function FlagValueDisplay() {
  const flagValue = useFlag('web-sdk-e2e-flag.str', 'default');
  return (
    <div>
      Flag value: <b>{String(flagValue)}</b>
    </div>
  );
}

function FlagEvalDisplay() {
  const flagEval = useEvaluateFlag('web-sdk-e2e-flag.str', 'default');
  return (
    <div>
      <b>Evaluation details:</b>
      <pre style={{ background: '#f6f8fa', padding: 8 }}>{JSON.stringify(flagEval, null, 2)}</pre>
    </div>
  );
}

// Example of using WithContext to provide a different context to a subtree
function InnerFlags() {
  const confidence = useConfidence();
  const flagValue = useFlag('web-sdk-e2e-flag.str', 'default');
  const flagEval = useEvaluateFlag('web-sdk-e2e-flag.str', 'default');
  const context = confidence.getContext();
  return (
    <div style={{ border: '1px dashed #aaa', padding: 8, marginTop: 8, display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div>
          Inner <b>useFlag</b> value: <b>{String(flagValue)}</b>
        </div>
        <div>
          Inner <b>useEvaluateFlag</b> details:
        </div>
        <pre style={{ background: '#f6f8fa', padding: 8 }}>{JSON.stringify(flagEval, null, 2)}</pre>
      </div>
      <div style={{ flex: 1 }}>
        <div>
          Current <b>context</b>:
        </div>
        <pre style={{ background: '#f6f8fa', padding: 8 }}>{JSON.stringify(context, null, 2)}</pre>
      </div>
    </div>
  );
}

interface TrackEventDemoProps {
  confidence: ReturnType<typeof useConfidence>;
}
function TrackEventDemo({ confidence }: TrackEventDemoProps) {
  const [eventName, setEventName] = useState('demo_event');
  const [payload, setPayload] = useState('{"clicked": true}');
  const [lastEvent, setLastEvent] = useState<{ name: string; data: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = () => {
    let data: any = undefined;
    setError(null);
    try {
      data = payload ? JSON.parse(payload) : undefined;
    } catch (e) {
      setError('Payload must be valid JSON');
      return;
    }
    confidence.track(eventName, data);
    setLastEvent({ name: eventName, data });
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <label>
          Event name:{' '}
          <input type="text" value={eventName} onChange={e => setEventName(e.target.value)} style={{ width: 120 }} />
        </label>
        <label>
          Payload (JSON):{' '}
          <input type="text" value={payload} onChange={e => setPayload(e.target.value)} style={{ width: 220 }} />
        </label>
        <button onClick={handleTrack}>Track event</button>
      </div>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {lastEvent && (
        <div style={{ fontSize: 14 }}>
          <b>Last event tracked:</b>
          <pre style={{ background: '#f6f8fa', padding: 8 }}>{JSON.stringify(lastEvent, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
