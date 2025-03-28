'use client';

import { useConfidence, useFlag, useConfidenceContext } from '@spotify-confidence/react/client';
import { useState } from 'react';

export function Content() {
  const confidence = useConfidence();
  const [targetingKey, setTargetingKey] = useState('user-a');
  const currentContext = useConfidenceContext();

  // Client-side flag resolution
  const buttonColor = useFlag('example.button.color', 'bg-blue-500');
  const buttonText = useFlag('example.button.text', 'Click me!');
  const showExtraContent = useFlag('example.content.show-extra', false);

  const toggleTargetingKey = () => {
    setTargetingKey(prev => prev === 'user-a' ? 'user-b' : 'user-a');
    confidence.setContext({ targeting_key: targetingKey === 'user-a' ? 'user-b' : 'user-a' });
  };

  return (
    <div className="container mx-auto p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Interactive Content</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Context</h2>
          <pre className="bg-gray-100 p-4 rounded mb-4">
            {JSON.stringify(currentContext, null, 2)}
          </pre>
          
          <button
            onClick={toggleTargetingKey}
            className={`${buttonColor} text-white px-4 py-2 rounded hover:opacity-90 transition-opacity`}
          >
            {buttonText}
          </button>
        </div>

        {showExtraContent && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Extra Content</h2>
            <p className="text-gray-600">
              This content is shown based on the feature flag &ldquo;example.content.show-extra&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 