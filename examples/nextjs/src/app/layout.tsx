import React from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import { ConfidenceProvider } from '@spotify-confidence/react/server';
import { getConfidence } from './confidence';
import './globals.css';
import Header from './components/Header';
import Content from './components/Content';
import Footer from './components/Footer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'QuantumFlow AI',
  description: 'A Next.js app demonstrating server-side and client-side rendering with Confidence',
};

export async function getConfidenceWithCookieContextAdded() {
  const cookieStore = await cookies();
  const targeting_key = cookieStore.get('cnfdVisitorId')?.value ?? 'default-visitor';
  const aiModel = cookieStore.get('aiModel')?.value ?? 'quantum-neural';
  const counterValue = cookieStore.get('counterValue')?.value ?? 0;
  return getConfidence({ targeting_key, aiModel, counterValue });
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // const confidence = await getConfidenceWithTargetingKey();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <React.Suspense fallback={<div>Loading...</div>}>
          <Header />
          <div className="flex-grow">
            <Content />
          </div>
          <Footer />
        </React.Suspense>
      </body>
    </html>
  );
}
