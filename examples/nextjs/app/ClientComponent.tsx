'use client';

import { useFlag, useConfidence } from '@spotify-confidence/react';
import React, { useState, useCallback, useMemo, useTransition } from 'react';

export default function ClientComponent() {
  const confidence = useConfidence();
  const [isPending, startTransition] = useTransition();

  const message = useFlag(
    'nextjs-example.message',
    'Unleash the power of quantum computing and neural networks to transform your business',
  );
  console.log('message', message);

  const [options, setOptions] = useState({
    quantumComputing: false,
    neuralNetworks: false,
    predictiveAnalytics: false,
  });

  const handleOptionChange = useCallback((option: keyof typeof options) => {
    setOptions(prev => ({
      ...prev,
      [option]: !prev[option],
    }));
  }, []);

  const handleStartJourney = useCallback(() => {
    startTransition(() => {
      const context = {
        quantum_computing: options.quantumComputing,
        neural_networks: options.neuralNetworks,
        predictive_analytics: options.predictiveAnalytics,
      };
      console.log('context', context);
      confidence.setContext({ options: context });
    });
  }, [options, confidence, startTransition]);

  const checkboxOptions = useMemo(
    () => [
      {
        id: 'quantumComputing',
        label: 'Quantum Computing',
        description: 'Harness quantum mechanics for exponential speed',
      },
      {
        id: 'neuralNetworks',
        label: 'Neural Networks',
        description: 'Deep learning for pattern recognition',
      },
      {
        id: 'predictiveAnalytics',
        label: 'Predictive Analytics',
        description: 'AI-powered future insights',
      },
    ],
    [],
  );

  return (
    <main className="min-h-screen flex items-center justify-center">
      <section className="container mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-7xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-purple-600 text-transparent bg-clip-text">
            QuantumAI
          </h1>
          <p className="text-2xl text-gray-300 mb-12 max-w-2xl mx-auto">{message}</p>

          {/* AI Options */}
          <div className="flex flex-row items-start justify-center space-x-8 mb-12">
            {checkboxOptions.map(({ id, label, description }) => (
              <div key={id} className="flex flex-col items-center space-y-2">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id={id}
                    checked={options[id as keyof typeof options]}
                    onChange={() => handleOptionChange(id as keyof typeof options)}
                    className="w-5 h-5 text-blue-600 rounded border-gray-600 focus:ring-blue-500 bg-gray-700"
                  />
                  <label htmlFor={id} className="text-gray-300">
                    {label}
                  </label>
                </div>
                <p className="text-sm text-gray-400 max-w-[200px]">{description}</p>
              </div>
            ))}
          </div>

          <button
            onClick={handleStartJourney}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-full text-lg transition-all shadow-lg hover:shadow-blue-500/20"
          >
            Start Your AI Journey
          </button>
        </div>
      </section>
    </main>
  );
}
