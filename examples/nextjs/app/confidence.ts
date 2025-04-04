import { Confidence } from '@spotify-confidence/sdk';
import React from 'react';

export const confidence = Confidence.create({
  clientSecret: process.env.CONFIDENCE_CLIENT_SECRET!,
  environment: 'backend',
  timeout: 1000,
  logger: console,
  cache: {
    scope: React.cache, // Use React.cache for server-side caching
  },
}).withContext({
  visitor_id: 'nick las',
  options: {
    quantum_computing: false,
    neural_networks: false,
    predictive_analytics: false,
  },
});
