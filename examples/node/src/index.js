import { Confidence } from '@spotify-confidence/sdk';
import { OpenFeature } from '@openfeature/server-sdk';
import { createConfidenceServerProvider } from '@spotify-confidence/openfeature-server-provider';
import express from 'express';

async function fetchImplementation(req) {
  const url = new URL(req.url);
  if (url.pathname.endsWith('/flags:apply')) {
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const start = performance.now();
  let res;
  try {
    res = await fetch(req);
    return res;
  } finally {
    const end = performance.now();
    const status = res?.status ?? 'ERR';
    console.log(`${url.pathname} ${status} took ${Math.round(end - start)}ms`);
  }
}
if (!process.env.CLIENT_SECRET) {
  console.log('CLIENT_SECRET is not set in .env');
}
const confidence = Confidence.create({
  clientSecret: process.env.CLIENT_SECRET,
  timeout: 250,
  logger: console,
  fetchImplementation,
  environment: 'backend',
});

const provider = createConfidenceServerProvider({
  clientSecret: process.env.CLIENT_SECRET,
  timeout: 250,
  logger: console,
  fetchImplementation,
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

const app = express();
const port = 3000;

// Function to perform a CPU-intensive calculation (e.g., finding prime numbers)
function findPrimes(iterations) {
  const primes = [];
  for (let i = 0; i < iterations; i++) {
    const candidate = Math.floor(Math.random() * 1000000) + 2; // Random number between 2 and 1,000,001
    let isPrime = true;
    for (let j = 2; j <= Math.sqrt(candidate); j++) {
      if (candidate % j === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) {
      primes.push(candidate);
    }
  }
  return primes;
}

// Endpoint to trigger CPU-intensive work
app.get('/generate-cpu-load', (req, res) => {
  const iterations = parseInt(req.query.iterations, 10) || 100000; // Get iterations from query param, default to 100,000
  console.log(`Generating CPU load with ${iterations} iterations...`);

  const startTime = process.hrtime();
  const result = findPrimes(iterations); // Perform the CPU-intensive task
  const endTime = process.hrtime(startTime);
  const durationInSeconds = endTime[0] + endTime[1] / 1e9;

  console.log(`CPU load generation finished in ${durationInSeconds.toFixed(4)} seconds.`);

  res.json({
    message: 'CPU load generated',
    iterations: iterations,
    primes_found: result.length,
    duration_seconds: durationInSeconds.toFixed(4),
  });
});

// Basic health check endpoint
app.get('/', (req, res) => {
  res.send('Node.js CPU load generator is running.');
});

app.listen(port, () => {
  console.log(`CPU load generator app listening at http://localhost:${port}`);
});

main().catch(err => {
  console.error(err);
  process.exit(1);
});

async function main() {
  console.log(`Starting example, will run for ${RUNTIME} minutes, at ${REQUESTS_PER_SECOND} RPS.`);
  const durationMs = RUNTIME * 60 * 1000; // RUNTIME minutes in milliseconds
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  let lastReportTime = startTime;

  while (Date.now() - startTime < durationMs) {
    console.log('evaluating flag');
    const { reason } = await evaluateFlagC(`user${Math.random()}`, 'web-sdk-e2e-flag');
    console.log('done evaluating flag', reason);
    if (reason === 'ERROR') {
      errorCount++;
      console.warn(reason);
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
