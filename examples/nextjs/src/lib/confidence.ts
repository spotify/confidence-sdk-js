import { Confidence, Context } from '@spotify-confidence/sdk';
import React from 'react';

if (!process.env.CONFIDENCE_CLIENT_SECRET) {
  console.warn('⚠️  No CONFIDENCE_CLIENT_SECRET found in environment variables.');
}

// Server-side Confidence instance
const confidence = Confidence.create({
  clientSecret: process.env.CONFIDENCE_CLIENT_SECRET!,
  environment: 'backend',
  timeout: 1000,
  logger: {},
  cache: {
    scope: React.cache, // Use React.cache for server-side caching
  },
});

// Confidence accessor for use in RSC (React Server Components)
export const getConfidence = (context: Context): Confidence => {
  return confidence.withContext(context);
};
