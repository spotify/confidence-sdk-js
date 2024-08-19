import { Confidence } from '@spotify-confidence/sdk';

const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  fetchImplementation: fetch,
  timeout: 1000,
  logger: console,
});
main();

async function main() {
  confidence.subscribe(state => console.log('state:', state));
  confidence.setContext({ targeting_key: 'user-a' });
  const fe = confidence.evaluateFlag('tutorial-feature.title', 'Default');

  console.log(fe);

  console.log(await fe);
}
