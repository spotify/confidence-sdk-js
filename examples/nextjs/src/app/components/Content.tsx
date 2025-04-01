'use client';

import React, { useState, useEffect } from 'react';
import { useConfidence } from '@spotify-confidence/react/client';
import Cookies from 'js-cookie';

const AI_MODELS = [
  { id: 'quantum-neural', name: 'Quantum Neural Matrix v3.2' },
  { id: 'synaptic-pulse', name: 'Synaptic Pulse Transformer' },
  { id: 'neural-sync', name: 'Neural Sync Pro' },
  { id: 'quantum-nexus', name: 'Quantum Nexus AI' },
  { id: 'cerebral-flow-dark', name: 'Cerebral Flow Network' },
];

const COOKIE_OPTIONS = { expires: 7 }; // Cookies expire in 7 days

export default function Content() {
  const [mounted, setMounted] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => Cookies.get('aiModel') || AI_MODELS[0].id);
  const [targetingKey, setTargetingKey] = useState(() => Cookies.get('cnfdVisitorId') || '');
  const [counterValue, setCounterValue] = useState(() => Cookies.get('counterValue') || 0);
  //const confidence = useConfidence();

  useEffect(() => {
    console.log('🌐 Content: Client-side mounted');
    setMounted(true);
  }, []);

  const handleTargetingKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🖱️ Content: Targeting key changed to:', targetingKey);
    const newValue = e.target.value;
    setTargetingKey(newValue);
  };

  const handleUpdateTargetingKey = () => {
    Cookies.set('cnfdVisitorId', targetingKey, COOKIE_OPTIONS);
    //confidence.setContext({ targeting_key: targetingKey });
  };

  const handleClearTargetingKey = () => {
    setTargetingKey('');
    Cookies.remove('cnfdVisitorId');
    //confidence.setContext({ targeting_key: '' });
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setSelectedModel(newValue);
    Cookies.set('aiModel', newValue, COOKIE_OPTIONS);
  };

  const handleCounterIncrement = () => {
    const newCounterValue = parseInt(counterValue) + 1;
    setCounterValue(newCounterValue);
    Cookies.set('counterValue', newCounterValue.toString(), COOKIE_OPTIONS);
  };

  const handleCounterDecrement = () => {
    const newCounterValue = parseInt(counterValue) - 1;
    setCounterValue(newCounterValue);
    Cookies.set('counterValue', newCounterValue.toString(), COOKIE_OPTIONS);
  };

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
            <p className="text-gray-700">Counter: {counterValue}</p>
            <button
              onClick={() => {
                console.log('🖱️ Content: Button clicked, count:', counterValue + 1);
                handleCounterIncrement();
              }}
              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            >
              Increment
            </button>

            <button
              onClick={() => {
                console.log('🖱️ Content: Button clicked, count:', counterValue - 1);
                handleCounterDecrement();
              }}
              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            >
              Decrement
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
              onChange={handleModelChange}
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
          <div className="mt-6">
            <label htmlFor="targeting-key" className="block text-sm font-medium text-gray-700 mb-2">
              Override Targeting Key
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="targeting-key"
                onChange={handleTargetingKeyChange}
                value={targetingKey}
                placeholder="Enter targeting key"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <button
                onClick={handleUpdateTargetingKey}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors whitespace-nowrap"
              >
                Update key
              </button>
              <button
                onClick={handleClearTargetingKey}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors whitespace-nowrap"
              >
                Clear ID
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Current targeting key: {targetingKey || 'Using default from cookie'}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
