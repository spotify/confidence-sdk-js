import React from 'react';
import Image from 'next/image';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-600 text-transparent bg-clip-text">
            QuantumAI Intelligence Suite
          </h1>
          <p className="text-2xl text-gray-300 mb-8">Harness the Power of Quantum Computing & Neural Networks</p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full text-lg transition-all">
            Start Your AI Journey
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-900/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">Revolutionary AI Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900">
              <h3 className="text-2xl font-bold mb-4">Neural Processing</h3>
              <p className="text-gray-300">
                Advanced deep learning algorithms powered by quantum computing principles.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900">
              <h3 className="text-2xl font-bold mb-4">Predictive Analytics</h3>
              <p className="text-gray-300">Real-time insights using state-of-the-art machine learning models.</p>
            </div>
            <div className="p-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900">
              <h3 className="text-2xl font-bold mb-4">Quantum Optimization</h3>
              <p className="text-gray-300">
                Breakthrough algorithms that solve complex business problems exponentially faster.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <h3 className="text-5xl font-bold text-blue-400 mb-2">99.9%</h3>
              <p className="text-gray-300">Accuracy Rate</p>
            </div>
            <div>
              <h3 className="text-5xl font-bold text-purple-400 mb-2">10x</h3>
              <p className="text-gray-300">Faster Processing</p>
            </div>
            <div>
              <h3 className="text-5xl font-bold text-pink-400 mb-2">24/7</h3>
              <p className="text-gray-300">AI-Powered Support</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-8">Ready to Transform Your Business?</h2>
          <p className="text-xl mb-8">Join the future of AI-powered business intelligence today.</p>
          <button className="bg-white text-blue-600 font-bold py-4 px-8 rounded-full text-lg hover:bg-gray-100 transition-all">
            Schedule a Demo
          </button>
        </div>
      </section>
    </main>
  );
}
