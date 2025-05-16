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
    console.log(`${url.pathname} ${status} took ${Math.round(end - start)}ms`);
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
  // fetchImplementation,
  // environment: 'backend',
});

let RUNTIME = 30;
if (process.env.RUNTIME) {
  RUNTIME = process.env.RUNTIME;
}

let REQUESTS_PER_SECOND = 10;
if (process.env.REQUESTS_PER_SECOND) {
  REQUESTS_PER_SECOND = parseInt(process.env.REQUESTS_PER_SECOND, 10);
}

OpenFeature.setProvider(provider);

main();

async function main() {
  console.log(`Starting example, will run for ${RUNTIME} minutes, at ${REQUESTS_PER_SECOND} RPS.`);
  const durationMs = RUNTIME * 60 * 1000; // RUNTIME minutes in milliseconds
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  let lastReportTime = startTime;

  while (Date.now() - startTime < durationMs) {
    const { reason } = await evaluateFlagOf(`user${Math.random()}`, 'web-sdk-e2e-flag');
    if (reason === 'ERROR') {
      errorCount++;
      console.log(reason);
    } else {
      successCount++;
    }

    // Report stats every 1 minute
    const currentTime = Date.now();
    if (currentTime - lastReportTime >= 60000) {
      const totalEvaluations = successCount + errorCount;
      const errorRatio = totalEvaluations === 0 ? 0 : errorCount / totalEvaluations;
      console.log(
        `STATS UPDATE (after ${Math.round(
          (currentTime - startTime) / 60000,
        )} min): Success: ${successCount}, Errors: ${errorCount}, Error Ratio: ${(errorRatio * 100).toFixed(2)}%`,
      );
      lastReportTime = currentTime;
    }

    await sleep(1000 / REQUESTS_PER_SECOND); // dynamically set RPS
  }

  console.log(`Finished running for ${RUNTIME} minutes.`);
  const finalTotalEvaluations = successCount + errorCount;
  const finalErrorRatio = finalTotalEvaluations === 0 ? 0 : errorCount / finalTotalEvaluations;
  console.log(
    `FINAL STATS: Success: ${successCount}, Errors: ${errorCount}, Error Ratio: ${(finalErrorRatio * 100).toFixed(2)}%`,
  );
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
