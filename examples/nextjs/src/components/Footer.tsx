import { getConfidence } from '@/lib/confidence';
import { cookies } from 'next/headers';

export async function Footer() {
  const cookieStore = await cookies();
  const targeting_key = cookieStore.get('cnfdVisitorId')?.value || 'default-user';
  const confidence = getConfidence({ targeting_key });

  // Server-side flag resolution
  const footerText = await confidence.getFlag('example.footer.text', '© 2024 Confidence Demo');
  const showSocialLinks = await confidence.getFlag('example.footer.show-social', true);

  return (
    <footer className="bg-gray-800 text-white p-4 mt-auto">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm mb-4 md:mb-0">
            {footerText}
          </div>
          {showSocialLinks && (
            <div className="flex space-x-4">
              <a href="#" className="hover:text-blue-400">Twitter</a>
              <a href="#" className="hover:text-blue-400">GitHub</a>
              <a href="#" className="hover:text-blue-400">LinkedIn</a>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
} 