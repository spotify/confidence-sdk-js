'use client';

import React, { useState, useEffect } from 'react';

const AI_MODELS = [
  { id: 'quantum-neural', name: 'Quantum Neural Matrix v3.2' },
  { id: 'synaptic-pulse', name: 'Synaptic Pulse Transformer' },
  { id: 'neural-sync', name: 'Neural Sync Pro' },
  { id: 'quantum-nexus', name: 'Quantum Nexus AI' },
  { id: 'cerebral-flow', name: 'Cerebral Flow Network' },
];

export default function Content() {
  const [count, setCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);

  useEffect(() => {
    console.log('🌐 Content: Client-side mounted');
    setMounted(true);
  }, []);

  if (!mounted) {
    console.log('⏳ Content: Initial server render');
    return <div>Loading...</div>;
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Interactive Content</h1>
        <p className="text-gray-600 mb-4">
          This is a client-side rendered component that demonstrates some client-only features:
        </p>
        <div className="space-y-4">
          <div>
            <p className="text-gray-700">Counter: {count}</p>
            <button
              onClick={() => {
                console.log('🖱️ Content: Button clicked, count:', count + 1);
                setCount(count + 1);
              }}
              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            >
              Increment
            </button>
          </div>
          <div>
            <p className="text-gray-700">Window Width: {typeof window !== 'undefined' ? window.innerWidth : 'N/A'}px</p>
          </div>
          <div className="mt-6">
            <label htmlFor="ai-model" className="block text-sm font-medium text-gray-700 mb-2">
              Select AI Model
            </label>
            <select
              id="ai-model"
              value={selectedModel}
              onChange={e => {
                console.log('🖱️ Content: AI Model selected:', e.target.value);
                setSelectedModel(e.target.value);
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {AI_MODELS.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500">Selected: {AI_MODELS.find(m => m.id === selectedModel)?.name}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
