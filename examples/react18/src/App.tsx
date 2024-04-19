import React from 'react';
import TestComponent from './TestComponent';

function App() {
  return (
    <>
      <h1>React 18 Example</h1>
      <div>
        <React.Suspense fallback={<p>Loading... </p>}>
          <TestComponent />
        </React.Suspense>
      </div>
      <p>
        // TODO wrap this amazing new kitten feature in a feature flag so it doesn't show up in production
        <img src="https://thepetshow.com/wp-content/uploads/2015/07/lion-mirror.jpg" alt="confident kitten" />
      </p>
      <p>bottom</p>
    </>
  );
}

export default App;
