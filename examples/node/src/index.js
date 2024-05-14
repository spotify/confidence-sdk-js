import { Confidence } from '@spotify-confidence/sdk';

const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  fetchImplementation: fetch,
  timeout: 1000,
});
// confidence.setContext()
main();

async function main() {
  const fe = confidence.withContext({ targeting_key: 'user-a' }).getFlag('web-sdk-e2e-flag.int', 0);
  console.log(fe);
  console.log(await fe);
}

// client
//   .getBooleanValue('web-sdk-e2e-flag.bool', false, {
//     targetingKey: `user-${Math.random()}`,
//   })
//   .then(result => {
//     console.log('result:', result);
//   });
