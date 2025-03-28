import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ConfidenceProvider } from '@spotify-confidence/react/server';
import { getConfidence } from '@/lib/confidence';
import { cookies } from 'next/headers';
import { Suspense } from 'react';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Confidence SDK Next.js Example",
  description: "Example of using Confidence SDK with Next.js server and client components",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const targeting_key = cookieStore.get('cnfdVisitorId')?.value || 'default-user';
  const confidence = getConfidence({ targeting_key });

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <ConfidenceProvider confidence={confidence}>
          <Suspense fallback={<div className="p-4">Loading...</div>}>
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </Suspense>
        </ConfidenceProvider>
      </body>
    </html>
  );
}
