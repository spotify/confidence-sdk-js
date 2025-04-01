import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { getBaseConfidence, getConfidence } from '../lib/confidence';
import { ConfidenceProvider } from '@spotify-confidence/react/server';
import { Suspense } from 'react';
import { Navbar } from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Confidence Demo',
  description: 'A demo of the Confidence SDK',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {


  const conf = await getConfidence({ visitor_id: 'default_button_style_visitor' });
  console.log("rendering layout")

  return (
    <html lang="en">
      <body className={inter.className}>
        {/* If you remove the navbar the loading behavior will be infinite */}
        <ConfidenceProvider confidence={conf}>
          <Navbar />
          {/* If you remove the Confidence Provider the loading behvior will ge away, i.e. it works */}


          <main className="min-h-screen">
            {children}
          </main>

        </ConfidenceProvider>
      </body>
    </html >
  );
}
