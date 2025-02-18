import React from 'react';

export default function Page() {
  return (
    <div>
      <h1>Learnings</h1>
      <ul>
        <li>We need to refactor the SDK into having a completely stateless "engine" that can be used server-side</li>
        <li>
          The concept of setting the context is a bit called into question. Context should always be in the form
          providers.
        </li>
        <li>
          Modern React and NextJS is difficult (and sometimes buggy). We've had to resort to two hacks, that might break
          with minor updates to React and/or NextJS
        </li>
        <li>
          We have the tools to create a nice NextJS experience, we still need to think about which combinations make
          sense.
        </li>
      </ul>
    </div>
  );
}
