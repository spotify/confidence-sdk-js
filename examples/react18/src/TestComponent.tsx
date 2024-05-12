import { useState } from 'react';
import { useConfidence, useFlagValue } from '@spotify-confidence/react-helpers';

const TestComponent = () => {
  const str = useFlagValue('web-sdk-e2e-flag.str', 'default');
  const [clickCount, setClickCount] = useState(0);
  const confidence = useConfidence();
  return (
    <>
      <p>The string flag value is: {str}</p>
      <p>Click count is: {clickCount}</p>
      <button
        onClick={() => {
          confidence.setContext({ targeting_key: `user-${Math.random()}` });
          confidence.track('click');
          setClickCount(value => value + 1);
        }}
      >
        Randomise Context
      </button>
    </>
  );
};

export default TestComponent;
