import { getConfidence } from '@/lib/confidence';
import Link from 'next/link';
import { Footer } from './Footer';

interface NavbarProps {
  onInvertedChange?: (inverted: boolean) => void;
}

export async function Navbar({ onInvertedChange }: NavbarProps = {}) {
  console.log('Navbar: Starting render');
  
  // Version 1: New button style visitor
  const confidence = getConfidence({ visitor_id: 'new_button_style_visitor' });
  console.log('Navbar: Confidence initialized');
  
  // Version 2: Default button style visitor
  // const confidence = getConfidence({ visitor_id: 'default_button_style_visitor' });

  // Server-side flag resolution
  console.log('Navbar: Starting flag resolution');
  const buttonStyle = await confidence.getFlag('button-style', { inverted: false });
  console.log('Navbar: Flag resolved', buttonStyle);

  // Notify parent of the inverted value
  onInvertedChange?.(buttonStyle.inverted);

  return (
    <>
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        buttonStyle.inverted 
          ? 'bg-white shadow-lg' 
          : 'bg-gradient-to-r from-blue-600 to-blue-800'
      }`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className={`text-xl font-bold ${
              buttonStyle.inverted ? 'text-blue-600' : 'text-white'
            }`}>
              Confidence Demo
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className={`px-4 py-2 rounded transition-opacity hover:opacity-90 ${
                  buttonStyle.inverted 
                    ? 'bg-white text-blue-500 border border-blue-500' 
                    : 'bg-blue-500 text-white'
                }`}
              >
                Home
              </Link>
              <Link 
                href="/page1"
                className={`px-4 py-2 rounded transition-opacity hover:opacity-90 ${
                  buttonStyle.inverted 
                    ? 'bg-white text-blue-500 border border-blue-500' 
                    : 'bg-blue-500 text-white'
                }`}
              >
                Page 1
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
} 