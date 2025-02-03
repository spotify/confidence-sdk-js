'use client';

import Image from 'next/image';
import { ConfidenceButton } from '@/components/ConfidenceButton';
import { useConfidence } from '@spotify-confidence/react';
import { ButtonStyleFlag } from '@/components/Flags';

export default function Home() {
  const confidence = useConfidence();
  const buttonStyle: ButtonStyleFlag = confidence.useFlag('button-style', { inverted: false });

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className={'w-max text-2xl font-bold'}>Confidence on Next.js</h1>
        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <ConfidenceButton inverted={buttonStyle.inverted} trackEvent={'button-navigation'} href={'/page1'}>
            Button Style
          </ConfidenceButton>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://confidence.spotify.com/docs"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image aria-hidden src="/file.svg" alt="File icon" width={16} height={16} />
          Read the Confidence Docs
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://github.com/spotify/confidence-sdk-js/tree/main/examples"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image aria-hidden src="/window.svg" alt="Window icon" width={16} height={16} />
          More JS Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://confidence.spotify.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image aria-hidden src="/globe.svg" alt="Globe icon" width={16} height={16} />
          Go to your Confidence Space
        </a>
      </footer>
    </div>
  );
}
