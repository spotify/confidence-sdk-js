import createServerContext from '@nimpl/context/create-server-context';
import getServerContext from '@nimpl/context/get-server-context';

import { FC, ReactNode } from 'react';

const ExampleContext = createServerContext<string>();

export default function Page() {
  console.log('Test page render', someServerfn.toString());
  return (
    <div>
      <ExampleContext.Provider value={'right'}>
        <Test />
      </ExampleContext.Provider>
      <Test />
    </div>
  );
}

const Test: FC<{ children?: ReactNode }> = async ({ children }) => {
  // debugger;
  console.log('Test render', getServerContext(ExampleContext));
  return (
    <fieldset>
      <legend>Test</legend>
      {children}
    </fieldset>
  );
};

async function someServerfn() {
  'use server';
  return 42;
}
