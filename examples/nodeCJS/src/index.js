const { OpenFeature } = require('@openfeature/server-sdk');

if (!process.env.CLIENT_SECRET) {
  console.log('CLIENT_SECRET is not set inb .env');
}
main();

async function main() {
  const { createConfidenceServerProvider } = await import('@spotify-confidence/openfeature-server-provider');

  const provider = createConfidenceServerProvider({
    clientSecret: process.env.CLIENT_SECRET,
    region: 'eu',
    fetchImplementation: fetch,
    timeout: 1000,
  });

  OpenFeature.setProvider(provider);

  const client = OpenFeature.getClient();

  client
    .getStringValue('tutorial-feature.title', 'Default', {
      targetingKey: `user-${Math.random()}`,
    })
    .then(result => {
      console.log('result:', result);
    });
}
