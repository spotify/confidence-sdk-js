import React from 'react';
import Link from 'next/link';
import { getConfidenceWithCookieContextAdded } from '../layout';

export default async function Header() {
  console.log('🖥️ Header: Server-side rendered');
  const confidence = await getConfidenceWithCookieContextAdded();

  // Feature flags for UI elements
  const showGitHubLink = await confidence.getFlag('nextjs-example.show-github-link', true);
  const showConfidenceLink = await confidence.getFlag('nextjs-example.show-confidence-link', true);
  const appName = await confidence.getFlag('nextjs-example.app-name', 'QuantumFlow AI');
  const headerStyle = await confidence.getFlag('nextjs-example.header-style', 'default');
  console.log('🖥️ Header: Server-side rendering with flags: ', {
    showGitHubLink,
    showConfidenceLink,
    appName,
    headerStyle,
  });
  // Get the appropriate header classes based on the style flag
  const getHeaderClasses = () => {
    switch (headerStyle) {
      case 'minimal':
        return 'bg-white';
      case 'dark':
        return 'bg-gray-800 text-white';
      default:
        return 'bg-white shadow-md';
    }
  };

  return (
    <header className={getHeaderClasses()}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <Link href="/" className={`text-xl font-bold ${headerStyle === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              {appName}
            </Link>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
            {showGitHubLink && (
              <Link
                href="https://github.com/spotify/confidence-sdk-js"
                className={`${
                  headerStyle === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                } px-3 py-2 rounded-md text-sm font-medium`}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </Link>
            )}
            {showConfidenceLink && (
              <Link
                href="https://confidence.spotify.com"
                className={`${
                  headerStyle === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                } px-3 py-2 rounded-md text-sm font-medium`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Confidence
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
