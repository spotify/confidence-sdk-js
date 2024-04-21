import { useState } from 'react';
import { useStringValue } from '@spotify-confidence/integration-react';
import { useConfidence } from './ConfidenceContext';

const TestComponent = () => {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');
  const [clickCount, setClickCount] = useState(0);
  const confidence = useConfidence({ component: 'Test' });
  return (
    <>
      <p>The string flag value is: {str}</p>
      <p>Click count is: {clickCount}</p>
      <button
        onClick={() => {
          // OpenFeature.setContext({ targetingKey: `user-${Math.random()}` });
          confidence.sendEvent('click');
          setClickCount(value => value + 1);
          // confidence.close();
        }}
      >
        Randomise OpenFeature Context
      </button>
    </>
  );
};

export default TestComponent;
