import { useConfidence, useFlagEvaluation } from '@spotify-confidence/react-helpers';
import { useState } from 'react';

const TestComponent = () => {
  const [clickCount, setClickCount] = useState(0);
  const confidence = useConfidence();
  const details = useFlagEvaluation('web-sdk-e2e-flag.str', 'default');
  // const details = confidence.getFlag('web-sdk-e2e-flag.str', 'default').orSuspend();
  return (
    <>
      <p>The flag is: </p>
      <pre>{JSON.stringify(details, null, '  ')}</pre>
      <p>Click count is: {clickCount}</p>
      <button
        onClick={() => {
          // confidence.track('click');
          setClickCount(value => value + 1);
        }}
      >
        Click
      </button>
      <button
        onClick={() => {
          confidence.setContext({ targeting_key: `user-${Math.random()}` });
        }}
      >
        Randomise Context
      </button>
    </>
  );
};

export default TestComponent;
