import { Confidence } from '@spotify-confidence/sdk';

if (!process.env.CLIENT_SECRET) {
  console.log('CLIENT_SECRET is not set in .env');
}
const confidence = Confidence.create({
  clientSecret: process.env.CLIENT_SECRET,
  timeout: 1000,
  logger: console,
});
main();

async function main() {
  console.log('Starting example');
  const fe = confidence.withContext({ targeting_key: 'user-a' }).evaluateFlag('tutorial-flag', {});
  console.log(fe);
  console.log(await fe);
}
