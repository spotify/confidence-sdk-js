import { getConfidence } from '@/lib/confidence';
import { cookies } from 'next/headers';
import Link from 'next/link';

export async function Navbar() {
  const cookieStore = await cookies();
  const targeting_key = cookieStore.get('cnfdVisitorId')?.value || 'default-user';
  const confidence = getConfidence({ targeting_key });

  // Server-side flag resolution
  const navColor = await confidence.getFlag('example.navbar.color', 'bg-blue-600');
  const showLogo = await confidence.getFlag('example.navbar.show-logo', true);

  return (
    <nav className={`${navColor} text-white p-4`}>
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {showLogo && (
            <div className="text-xl font-bold">Confidence Demo</div>
          )}
          <div className="hidden md:flex space-x-4">
            <Link href="/" className="hover:text-blue-200">Home</Link>
            <Link href="/about" className="hover:text-blue-200">About</Link>
            <Link href="/contact" className="hover:text-blue-200">Contact</Link>
          </div>
        </div>
        <div className="text-sm">
          Server Rendered Navbar
        </div>
      </div>
    </nav>
  );
} 