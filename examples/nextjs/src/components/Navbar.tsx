import React from 'react';
import Link from 'next/link';
import { getConfidence } from '../lib/confidence';

export async function Navbar() {
  const conf = await getConfidence({ visitor_id: 'default_button_style_visitor' });
  const buttonStyle = await conf.getFlag('button-style', { inverted: false });
  

  return (
    <nav className={`shadow-lg ${buttonStyle.inverted ? 'bg-gray-100' : 'bg-blue-600'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className={`text-xl font-bold ${buttonStyle.inverted ? 'text-black' : 'text-white'}`}>
                Confidence Demo
              </Link>
            </div>
            <div className="sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  buttonStyle.inverted ? 'text-black' : 'text-white'
                }`}
              >
                Home
              </Link>
              <Link
                href="/page1"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  buttonStyle.inverted ? 'text-black' : 'text-white'
                }`}
              >
                Page 1
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <select
              className={`ml-4 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md ${
                buttonStyle.inverted ? 'bg-white' : 'bg-blue-700 text-white border-blue-600'
              }`}
              defaultValue="default_button_style_visitor"
            >
              <option value="default_button_style_visitor">Default Style</option>
              <option value="new_button_style_visitor">New Style</option>
            </select>
          </div>
        </div>
      </div>
    </nav>
  );
} 