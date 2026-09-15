const { OpenFeature } = require('@openfeature/server-sdk');
const { ConfidenceClient, FlagBundle } = require('@spotify-confidence/sdk');
const { createConfidenceServerProvider } = require('@spotify-confidence/openfeature-server-provider');

if (!process.env.CLIENT_SECRET) {
  throw new Error('Set CLIENT_SECRET before running the example');
}

async function main() {
  const provider = createConfidenceServerProvider({
    clientSecret: process.env.CLIENT_SECRET,
    region: 'eu',
    timeout: 1000,
  });
  await OpenFeature.setProviderAndWait(provider);
  try {
    const result = await OpenFeature.getClient().getStringValue('tutorial-feature.title', 'Default', {
      targetingKey: 'user-a',
    });
    console.log('from OpenFeature:', result);

    const client = new ConfidenceClient({ clientSecret: process.env.CLIENT_SECRET, region: 'eu' });
    const bundle = await client.resolve(
      ['tutorial-feature'],
      { targeting_key: 'user-a' },
      { signal: AbortSignal.timeout(1000) },
    );
    console.log('from the thin client:', FlagBundle.evaluate(bundle, 'tutorial-feature.title', 'Default'));
  } finally {
    await OpenFeature.clearProviders();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
