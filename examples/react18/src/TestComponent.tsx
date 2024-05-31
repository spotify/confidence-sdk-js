import { useConfidence } from '@spotify-confidence/react';
import { createContext, useContext, useState } from 'react';

const fakeContext = createContext(undefined);

const TestComponent = () => {
  const [clickCount, setClickCount] = useState(0);
  const confidence = useConfidence();
  // const details = useFlagEvaluation('web-sdk-e2e-flag.str', 'default');
  // const details = confidence.evaluateFlag('web-sdk-e2e-flag.str', 'default');
  const details = confidence.useFlag('web-sdk-e2e-flag.str', 'default');
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
          console.log('got targeting  key:', targeting_key);
          if (targeting_key === 'user-a') {
            targeting_key = 'user-b';
          } else {
            targeting_key = 'user-a';
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

function isRendering(): boolean {
  try {
    // eslint-disable-next-line
    useContext(fakeContext);
    return true;
  } catch (e) {
    return false;
  }
}
