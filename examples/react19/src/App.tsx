import React, { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>React 19 Example</h1>
      <p>This is a barebones React 19 client-side app. No SSR, no extra tooling.</p>
      <hr />
      <h2>Counter Demo</h2>
      <p>
        Current count: <b>{count}</b>
      </p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <p style={{ color: '#888', marginTop: 32 }}>If this counter works, React is running!</p>
    </main>
  );
}

export default App;
