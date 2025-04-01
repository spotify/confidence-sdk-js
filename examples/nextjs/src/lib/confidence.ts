import { Confidence, type Context } from '@spotify-confidence/sdk';
import React from 'react';

if (!process.env.CLIENT_TOKEN) {
  throw new Error('CLIENT_TOKEN environment variable is required. Please check your .env.local file.');
}

const confidence = Confidence.create({
  clientSecret: process.env.CLIENT_TOKEN,
  environment: 'backend',
  timeout: 1000,
  logger: console,
  cache: {
    scope: React.cache,
  },
});

export const getConfidence = (context: Context): Confidence => {
  return confidence.withContext(context);
};