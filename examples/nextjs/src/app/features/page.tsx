import React from 'react';

const FEATURES = [
  {
    title: 'Advanced AI Models',
    description: 'Choose from our suite of cutting-edge AI models, each optimized for specific use cases.',
    models: [
      'Quantum Neural Matrix v3.2',
      'Synaptic Pulse Transformer',
      'Neural Sync Pro',
      'Quantum Nexus AI',
      'Cerebral Flow Network',
    ],
  },
];

export default function FeaturesPage() {
  console.log('[FeaturesPage] Rendering Features page');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Features</h1>
        <p className="mt-4 text-lg text-gray-500">Discover the powerful capabilities of QuantumFlow AI</p>
      </div>

      <div className="mt-16 space-y-12">
        {FEATURES.map((feature, index) => {
          console.log(`[FeaturesPage] Rendering feature: ${feature.title}`);
          return (
            <div key={index} className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h2>
              <p className="text-gray-600 mb-6">{feature.description}</p>
              {feature.models && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Available Models</h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-600">
                    {feature.models.map((model, modelIndex) => {
                      console.log(`[FeaturesPage] Rendering model: ${model}`);
                      return <li key={modelIndex}>{model}</li>;
                    })}
                  </ul>
                </div>
              )}
              {feature.details && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Key Details</h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-600">
                    {feature.details.map((detail, detailIndex) => (
                      <li key={detailIndex}>{detail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
