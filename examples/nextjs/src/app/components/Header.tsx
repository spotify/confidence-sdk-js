import React from 'react';
import Link from 'next/link';

export default function Header() {
  console.log('🖥️ Header: Server-side rendered');

  return (
    <header className="bg-white shadow-md">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <Link href="/" className="text-xl font-bold text-gray-800">
              QuantumFlow AI
            </Link>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
            <Link
              href="https://github.com/spotify/confidence-sdk-js"
              className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Link>
            <Link
              href="https://confidence.spotify.com"
              className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              Confidence
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
