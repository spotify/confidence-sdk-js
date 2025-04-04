import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from './Header';
import { Footer } from './Footer';
import { ConfidenceProvider } from '@spotify-confidence/react/server';
import { confidence } from './confidence';
import Loading from './loading';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'QuantumAI - Revolutionary AI-Powered Business Intelligence',
  description:
    'Transform your business with our cutting-edge AI solutions powered by quantum computing and neural networks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gradient-to-b from-gray-900 to-black text-white min-h-screen`}>
        <ConfidenceProvider confidence={confidence}>
          <Header />
          <Suspense fallback={<Loading />}>{children}</Suspense>
          <Footer />
        </ConfidenceProvider>
      </body>
    </html>
  );
}
