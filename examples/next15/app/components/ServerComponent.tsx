import React, { FC, ReactNode } from 'react';
import { getConfidence } from 'flags';

export const ServerComponent: FC<{ children?: ReactNode }> = async ({ children }) => {
  console.log('ServerComponent render');
  const confidence = await getConfidence();
  const details = await confidence.evaluateFlag('web-sdk-e2e-flag.str', 'red');
  console.log('ServerComponent details', details);
  return (
    <fieldset>
      <legend>ServerComponent</legend>
      <h1 style={{ color: details.value }}>
        Hello {confidence.getContext().targeting_key} {details.value}
      </h1>
      {children}
    </fieldset>
  );
};

// async function getVisitorId() {
//   const cookieStore = await cookies();
//   return cookieStore.get('visitor.id')?.value;
// }
