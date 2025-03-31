import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ConfidenceProvider } from '@spotify-confidence/react/server';
import { getConfidence } from '@/lib/confidence';
import { Suspense } from 'react';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Confidence SDK Next.js Example",
  description: "Example of using Confidence SDK with Next.js server and client components",
};

function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-red-500">
        <h2>Something went wrong!</h2>
        <pre>{error.message}</pre>
      </div>
    </div>
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log('Layout: Starting render');
  try {
    // Version 1: New button style visitor
    console.log('Layout: Initializing confidence');
    const confidence = getConfidence({ visitor_id: 'new_button_style_visitor' });
    console.log('Layout: Confidence initialized');
    
    // Version 2: Default button style visitor
    // const confidence = getConfidence({ visitor_id: 'default_button_style_visitor' });

    // Resolve the flag in the layout
    console.log('Layout: Starting flag resolution');
    const buttonStyle = await confidence.getFlag('button-style', { inverted: false });
    console.log('Layout: Flag resolved', buttonStyle);

    console.log('Layout: Starting to render JSX');
    return (
      <html lang="en">
        <body className={`${inter.className} min-h-screen flex flex-col`}>
          <ConfidenceProvider confidence={confidence}>
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
            <Footer inverted={buttonStyle.inverted} />
          </ConfidenceProvider>
        </body>
      </html>
    );
  } catch (error) {
    console.error('Layout error:', error);
    return (
      <html lang="en">
        <body className={inter.className}>
          <ErrorBoundary error={error as Error} />
        </body>
      </html>
    );
  }
}
