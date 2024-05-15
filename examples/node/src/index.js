import { Confidence } from '@spotify-confidence/sdk';

const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  fetchImplementation: fetch,
  timeout: 1000,
  logger: console,
});
// confidence.setContext()
main();

async function main() {
  // confidence.subscribe(state => console.log('state:', state));
  confidence.setContext({ targeting_key: 'user-a' });
  const fe = await confidence.evaluateFlag('web-sdk-e2e-flag.int', 0);

  console.log(fe);
  confidence.setContext({ targeting_key: 'user-b' });
  // console.log(await fe);
}

// client
//   .getBooleanValue('web-sdk-e2e-flag.bool', false, {
//     targetingKey: `user-${Math.random()}`,
//   })
//   .then(result => {
//     console.log('result:', result);
//   });
