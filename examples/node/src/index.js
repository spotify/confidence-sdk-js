import { Confidence } from '@spotify-confidence/sdk';
import { OpenFeature } from '@openfeature/server-sdk';
import { createConfidenceServerProvider } from '@spotify-confidence/openfeature-server-provider';
async function fetchImplementation(req) {
  const start = performance.now();
  let res;
  try {
    res = await fetch(req);
    return res;
  } finally {
    const end = performance.now();
    const url = new URL(req.url);
    const status = res?.status ?? 'ERR';
    console.log(`${url.pathname} ${status} took ${end - start}ms`);
  }
}
if (!process.env.CLIENT_SECRET) {
  console.log('CLIENT_SECRET is not set in .env');
}
// const confidence = Confidence.create({
//   clientSecret: process.env.CLIENT_SECRET,
//   timeout: 1000,
//   logger: console,
//   fetchImplementation,
//   environment: 'backend',
// });

const provider = createConfidenceServerProvider({
  clientSecret: process.env.CLIENT_SECRET,
  timeout: 250,
  logger: console,
  // environment: 'backend',
});

OpenFeature.setProvider(provider);

main();

async function main() {
  console.log('Starting example');
  for (let i = 0; i < 1000; i++) {
    const { reason } = await evaluateFlagOf('user' + Math.random(), 'web-sdk-e2e-flag');
    if (reason === 'ERROR') console.log(reason);
    await sleep(1000 / 50);
  }
}

async function evaluateFlagOf(targetingKey, flagName) {
  const client = OpenFeature.getClient();

  return client.getObjectDetails(flagName, {}, { targetingKey });
}

function evaluateFlagC(targeting_key, flagName) {
  return confidence.withContext({ targeting_key }).getFlag(flagName, {});
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
