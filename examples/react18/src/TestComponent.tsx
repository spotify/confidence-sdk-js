import { useState } from 'react';
import { useStringFlagValue } from '@openfeature/react-sdk';
import { useConfidence } from './ConfidenceContext';
import { OpenFeature } from '@openfeature/web-sdk';

const TestComponent = () => {
  const str = useStringFlagValue('web-sdk-e2e-flag.str', 'default');
  const [clickCount, setClickCount] = useState(0);
  const confidence = useConfidence({ component: 'Test' });
  return (
    <>
      <p>The string flag value is: {str}</p>
      <p>Click count is: {clickCount}</p>
      <button
        onClick={() => {
          OpenFeature.setContext({ targetingKey: `user-${Math.random()}` });
          confidence.track('click');
          setClickCount(value => value + 1);
        }}
      >
        Randomise OpenFeature Context
      </button>
    </>
  );
};

export default TestComponent;
