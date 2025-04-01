import React from 'react';
import Link from 'next/link';
import { getConfidence } from '@/lib/confidence';
import { getVisitorId } from '@/lib/storage';

export default async function Header() {
  console.log('[Header] Starting Header component render');
  const visitorId = getVisitorId() || 'not set';
  console.log('[Header] Visitor ID:', visitorId);
  const confidence = getConfidence({ visitor_id: visitorId });
  const showHeaders = await confidence.getFlag('nextjs-example.show-headers', false);
  console.log('[Header] showHeaders:', showHeaders);

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-900">
                QuantumFlow AI
              </Link>
            </div>
            <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Home
              </Link>
              {showHeaders && (
                <>
                  <Link
                    href="/features"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Features
                  </Link>
                  <Link
                    href="/docs"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Documentation
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center">
            <div className="text-sm text-gray-500">{visitorId ? `Visitor ID: ${visitorId}` : 'No visitor ID set'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
