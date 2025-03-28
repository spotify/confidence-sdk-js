import { Confidence } from '@spotify-confidence/sdk';
import { cache } from 'react';

if (!process.env.CONFIDENCE_CLIENT_SECRET) {
  throw new Error('CONFIDENCE_CLIENT_SECRET is not set');
}

// Create a cached version of the Confidence client for server components
export const getConfidence = cache((context: Record<string, string> = {}) => {
  return Confidence.create({
    clientSecret: process.env.CONFIDENCE_CLIENT_SECRET!,
    environment: 'backend',
    timeout: 1000,
    logger: console,
    cache: {
      scope: cache, // Use React.cache for server-side caching
    },
  }).withContext(context);
});

// Create a client-side version of the Confidence client
export const createClientConfidence = () => {
  return Confidence.create({
    clientSecret: process.env.NEXT_PUBLIC_CONFIDENCE_CLIENT_SECRET!,
    environment: 'client',
    timeout: 1000,
    logger: console,
  });
}; 