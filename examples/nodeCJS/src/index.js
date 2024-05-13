const { OpenFeature } = require('@openfeature/server-sdk');

main();

async function main() {
  const { createConfidenceServerProvider } = await import('@spotify-confidence/openfeature-server-provider');

  const provider = createConfidenceServerProvider({
    clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    region: 'eu',
    fetchImplementation: fetch,
    timeout: 1000,
  });

  OpenFeature.setProvider(provider);

  const client = OpenFeature.getClient();

  client
    .getBooleanValue('web-sdk-e2e-flag.bool', false, {
      targetingKey: `user-${Math.random()}`,
    })
    .then(result => {
      console.log('result:', result);
    });
}
