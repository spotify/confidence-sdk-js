const { OpenFeature } = require('@openfeature/server-sdk');
const { Confidence } = require('@spotify-confidence/sdk');
const { createConfidenceServerProvider } = require('@spotify-confidence/openfeature-server-provider');

main();

async function main() {
  const confidence = Confidence.create({
    clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    region: 'eu',
    fetchImplementation: fetch,
    timeout: 1000,
    environment: 'backend',
  });

  const provider = createConfidenceServerProvider(confidence);

  OpenFeature.setProvider(provider);

  const client = OpenFeature.getClient();

  client
    .getBooleanValue('web-sdk-e2e-flag.int', 0, {
      targetingKey: `user-a`,
    })
    .then(result => {
      console.log('result from open feature:', result);
    });

  const fe = await confidence.withContext({ targeting_key: 'user-a' }).evaluateFlag('web-sdk-e2e-flag.int', 0);
  console.log('from confidence API: ', fe);
}
