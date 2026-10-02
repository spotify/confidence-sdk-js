import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const reviewDist = resolve(here, '..', '..', 'csr', 'privacy-review', 'dist');
const port = Number(process.env.PRIVACY_REVIEW_PORT ?? 4173);

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  let file;

  if (pathname === '/') {
    file = resolve(here, 'index.html');
  } else if (/^\/sdk\/[a-zA-Z0-9_-]+\.js$/.test(pathname)) {
    file = resolve(reviewDist, pathname.slice('/sdk/'.length));
  } else {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  try {
    const contentType = extname(file) === '.js' ? 'text/javascript' : 'text/html';
    response.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(readFileSync(file));
  } catch {
    response.writeHead(500);
    response.end('Build the privacy-review package before running this demo.');
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Bufo privacy review demo: http://127.0.0.1:${port}/\n`);
});
