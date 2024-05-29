import { useConfidence, useFlagEvaluation, useFlagValue } from '@spotify-confidence/react-helpers';
import { useState } from 'react';

const TestComponent = () => {
  const [clickCount, setClickCount] = useState(0);
  const confidence = useConfidence({ targeting_key: 'user-a' });
  // const details = useFlagEvaluation('web-sdk-e2e-flag.str', 'default');
  // const details = confidence.evaluateFlag('web-sdk-e2e-flag.str', 'default');
  const details = confidence.getFlag('web-sdk-e2e-flag.str', 'default');
  // const details = useFlagValue('web-sdk-e2e-flag.str', 'default');
  return (
    <>
      <p>The flag is: </p>
      <pre>{JSON.stringify(details, null, '  ')}</pre>
      <p>Click count is: {clickCount}</p>
      <button
        onClick={() => {
          confidence.track('click');
          setClickCount(value => value + 1);
        }}
      >
        Click
      </button>
      <button
        onClick={() => {
          let { targeting_key } = confidence.getContext();
          if (targeting_key === 'user_a') {
            targeting_key = 'user_b';
          } else {
            targeting_key = 'user_a';
          }
          confidence.setContext({ targeting_key });
        }}
      >
        Randomise Context
      </button>
    </>
  );
};

export default TestComponent;
