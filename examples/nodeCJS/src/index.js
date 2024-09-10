const { OpenFeature } = require('@openfeature/server-sdk');
const { Confidence } = require('@spotify-confidence/sdk');
const { createConfidenceServerProvider } = require('@spotify-confidence/openfeature-server-provider');

if (!process.env.CLIENT_SECRET) {
  console.log('CLIENT_SECRET is not set in .env');
}
main();

async function main() {
  const confidence = Confidence.create({
    clientSecret: process.env.CLIENT_SECRET,
    region: 'eu',
    fetchImplementation: fetch,
    timeout: 1000,
    environment: 'backend',
  });

  const provider = createConfidenceServerProvider(confidence);

  OpenFeature.setProvider(provider);

  const client = OpenFeature.getClient();

  client
    .getStringValue('tutorial-feature.title', 'Default', {
      targetingKey: `user-${Math.random()}`,
    })
    .then(result => {
      console.log('result from open feature:', result);
    });

  const fe = await confidence
    .withContext({ targeting_key: 'user-a' })
    .evaluateFlag('tutorial-feature.title', 'Default');
  console.log('from confidence API: ', fe);
}
