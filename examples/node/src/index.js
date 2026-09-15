import { ConfidenceClient, FlagBundle } from '@spotify-confidence/sdk';

if (!process.env.CLIENT_SECRET) {
  throw new Error('Set CLIENT_SECRET before running the example');
}

const client = new ConfidenceClient({
  clientSecret: process.env.CLIENT_SECRET,
  logger: console,
});

const bundle = await client.resolve(
  ['tutorial-feature'],
  { targeting_key: 'user-a' },
  { signal: AbortSignal.timeout(1000) },
);
console.log(FlagBundle.evaluate(bundle, 'tutorial-feature.title', 'Default'));
