import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { confidence } from './confidence';

export const Header = async () => {
  const isHeroHeader = await confidence.getFlag('nextjs-example.hero', false);

  return (
    <header
      className={`w-full z-50 ${
        isHeroHeader
          ? 'absolute top-0 bg-transparent'
          : 'fixed top-0 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className={`flex items-center ${isHeroHeader ? 'justify-center h-32' : 'justify-between h-20'}`}>
          {/* Logo */}
          <Link href="/" className={`font-bold text-gradient ${isHeroHeader ? 'text-4xl md:text-5xl' : 'text-2xl'}`}>
            QuantumAI
          </Link>

          {/* Navigation - Only show when not in hero mode */}
          {!isHeroHeader && (
            <>
              <nav className="hidden md:flex items-center space-x-8">
                <Link href="#features" className="text-gray-300 hover:text-white transition-colors">
                  Features
                </Link>
                <Link href="#solutions" className="text-gray-300 hover:text-white transition-colors">
                  Solutions
                </Link>
                <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">
                  Pricing
                </Link>
                <Link href="#about" className="text-gray-300 hover:text-white transition-colors">
                  About
                </Link>
              </nav>

              {/* CTA Buttons */}
              <div className="flex items-center space-x-4">
                <button className="hidden md:block px-4 py-2 text-gray-300 hover:text-white transition-colors">
                  Sign In
                </button>
                <button className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-2 rounded-full transition-colors">
                  Get Started
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
