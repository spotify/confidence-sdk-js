import React from 'react';

const DOCS_SECTIONS = [
  {
    title: 'Getting Started',
    description: 'Quick setup guide for integrating QuantumFlow AI into your application.',
    steps: [
      'Install the required dependencies',
      'Configure your environment variables',
      'Initialize the client',
      'Start using the API',
    ],
  },
];

export default function DocsPage() {
  console.log('[DocsPage] Rendering Documentation page');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Documentation</h1>
        <p className="mt-4 text-lg text-gray-500">Everything you need to know about using QuantumFlow AI</p>
      </div>

      <div className="mt-16 space-y-12">
        {DOCS_SECTIONS.map((section, index) => {
          console.log(`[DocsPage] Rendering section: ${section.title}`);
          return (
            <div key={index} className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{section.title}</h2>
              <p className="text-gray-600 mb-6">{section.description}</p>
              {section.steps && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Steps</h3>
                  <ol className="list-decimal list-inside space-y-2 text-gray-600">
                    {section.steps.map((step, stepIndex) => {
                      console.log(`[DocsPage] Rendering step ${stepIndex + 1}: ${step}`);
                      return <li key={stepIndex}>{step}</li>;
                    })}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
