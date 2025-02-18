import createServerContext from '@nimpl/context/create-server-context';
import getServerContext from '@nimpl/context/get-server-context';

import { FC, ReactNode } from 'react';

export default async function Page() {
  console.log('Test render');
  return (
    <div>
      <Test />
    </div>
  );
}

const Test: FC<{ children?: ReactNode }> = async ({ children }) => {
  // debugger;
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
