import React from 'react';

export default function Page() {
  return (
    <div>
      <h1>NextJS demo</h1>
      <ul>
        <li>We've created a POC for the different ways of integrating with NextJS rendering modes</li>
        <li>
          We're using a mocked version of the SDK itself, cause it would be to cumbersome to refactor the SDK while
          experimenting
        </li>
        <li>
          Not sure if I'll have time to show code.. but the whole point is that the code is identical to how our React
          SDK functions today. You wrap your component tree in ConfidenceProvider and then you can request flag values
          in any component below
        </li>
      </ul>
    </div>
  );
}
