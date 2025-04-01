'use client';

import { FlagDisplay } from '../components/FlagDisplay';
import { Suspense } from 'react';
export default function Home() {
  //return (<div>Hello World</div>)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <Suspense fallback={<h1>Loading...</h1>}>
        <FlagDisplay />
      </Suspense>
    </div>
  );
}
