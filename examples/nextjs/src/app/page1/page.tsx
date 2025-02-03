'use client';

import { useConfidence } from '@spotify-confidence/react';
import { Flags } from '@/components/Flags';

export default function Home() {
  const confidence = useConfidence();
  const title = confidence.useFlag('tutorial-feature.title', 'Default Title');
  const message = confidence.useFlag('tutorial-feature.message', 'Default message');
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1>{title}</h1>
        <p>{message}</p>
        <Flags />
      </main>
    </div>
  );
}
