'use client';

import React, { useState, useEffect } from 'react';

export default function BrowserFeatures() {
  const [mounted, setMounted] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setMounted(true);

    // Window size
    const handleResize = () => {
      setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 1000);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!mounted) {
    console.log('[BrowserFeatures] Not mounted');
    return <div>Loading browser features...</div>;
  }
  console.log('[BrowserFeatures] Mounted');
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Browser Features</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Window Size</h3>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {windowSize.width} × {windowSize.height}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
