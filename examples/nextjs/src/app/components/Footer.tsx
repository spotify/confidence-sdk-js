import React from 'react';

export default function Footer() {
  console.log('🖥️ Footer: Server-side rendered');

  return (
    <footer className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm font-semibold mb-2">Our Vision</h3>
            <p className="text-xs text-gray-300">
              We are the vanguard of AI-driven technological innovation, pioneering the future of digital transformation
              through cutting-edge machine learning and neural networks. Our mission transcends mere business
              objectives; we are architects of tomorrow's AI-powered digital landscape, crafting solutions that redefine
              the boundaries of what's possible in the digital realm.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Global Presence</h3>
            <p className="text-xs text-gray-300">
              AI Innovation Hub Headquarters
              <br />
              123 Quantum Drive
              <br />
              Silicon Valley, CA 94025
              <br />
              United States of America
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Corporate Excellence</h3>
            <p className="text-xs text-gray-300">
              © 2024 TechCorp International. All rights reserved.
              <br />
              Privacy Policy | Terms of Service | Corporate Governance | AI Ethics
            </p>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-700 text-center text-gray-300">
          <p className="text-xs italic">
            "Empowering the future through AI-driven innovation and unwavering commitment to technological excellence"
          </p>
        </div>
      </div>
    </footer>
  );
}
