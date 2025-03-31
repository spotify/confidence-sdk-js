import { getConfidence } from '@/lib/confidence';

interface FooterProps {
  inverted: boolean;
}

export function Footer({ inverted }: FooterProps) {
  return (
    <footer className={`py-8 ${
      inverted 
        ? 'bg-gray-100' 
        : 'bg-gradient-to-r from-blue-600 to-blue-800'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center space-y-4">
          <p className={`text-center ${
            inverted ? 'text-gray-800' : 'text-white'
          }`}>
            Built with Confidence SDK
          </p>
          <a
            href="https://github.com/spotify/confidence-sdk-js"
            target="_blank"
            rel="noopener noreferrer"
            className={`px-6 py-2 rounded-full transition-all duration-300 ${
              inverted 
                ? 'bg-white text-blue-500 border border-blue-500 hover:bg-blue-50' 
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            View on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
} 