import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from './components/Header';
import { ConfidenceProvider } from '@spotify-confidence/react/server';
import { getConfidence } from '@/lib/confidence';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'QuantumFlow AI',
  description: 'Next.js example with Confidence Feature Flagging',
};

export default function rootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConfidenceProvider confidence={getConfidence({})}>
          <Suspense fallback={<div>Loading...</div>}>
            <Header />
            {children}
          </Suspense>
        </ConfidenceProvider>
      </body>
    </html>
  );
}
