import React, { FC, Suspense, use } from 'react';
import { fetchData } from './api';
/* eslint-disable no-console */

export const ServerComponent: FC<{ name?: string }> = ({ name = 'hawkeye' }) => {
  console.log('rendering server component..........', Date.now());
  //   const time = use(fetchData());
  return (
    <>
      <h1>Hello {name}</h1>
      <Suspense fallback="loading....">
        <DataViewComponent />
      </Suspense>
    </>
  );
};

const DataViewComponent: FC = () => {
  const time = use(fetchData());
  return <div>{time}</div>;
};
