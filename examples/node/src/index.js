import { Confidence } from '@spotify-confidence/sdk';

if (!process.env.CLIENT_SECRET) {
  console.log('CLIENT_SECRET is not set inb .env');
}
const confidence = Confidence.create({
  clientSecret: process.env.CLIENT_SECRET,
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
