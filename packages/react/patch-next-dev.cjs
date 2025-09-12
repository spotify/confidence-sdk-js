#!/usr/bin/env node

const path = require('node:path');
const fs = require('node:fs');

// /next/dist/compiled/next-server/pages.runtime.dev.js.bak

const filePath = path.resolve(require.resolve('next'), '..', '..', 'compiled', 'next-server', 'pages.runtime.dev.js');
if (!fs.existsSync(filePath)) {
  console.error('could not find file to patch', path.relative('.', filePath));
  process.exit(1);
}
const bakPath = filePath + '.bak';

const patchSearch = '(element,streamOptions)';
const patchReplace = '(element,{onError:(e)=>(console.log(e),e.digest),...streamOptions})';
const preamble = [
  '// This file is patched by @spotify-confidence/react',
  '// A backup of the original exists as react-dom-server.edge.development.js.bak',
  '',
].join('\n');

const cmd = process.argv[2];
switch (cmd) {
  case undefined:
  case 'apply':
    apply();
    break;
  case 'revert':
    revert();
    break;
  case 'test':
    console.log(`patch is ${test() ? '' : 'not '}applied`);
    break;
  default:
    console.error(
      [
        'command must be "apply", "revert" or "test"',
        '',
        'This tool applies a patch to next/dist/compiled/next-server/pages.runtime.dev.js',
        '',
        'When using Next.js with the pages router in dev mode, there is a bug where ',
        'SSR errors lose their digest information, breaking intentional bailout patterns ',
        'that use magic digests like "BAILOUT_TO_CLIENT_SIDE_RENDERING" to suppress error overlays.',
        '',
        'This patch fixes this by making the Next.js dev server call react-dom/server ',
        'with an error handler that properly propagates the error digest.',
      ].join('\n'),
    );
    process.exit(1);
}

function test(source = fs.readFileSync(filePath, { encoding: 'utf8' })) {
  return source.startsWith(preamble);
}

function apply() {
  const source = fs.readFileSync(filePath, { encoding: 'utf8' });

  if (test(source)) {
    console.log('patch is already applied');
    return;
  }

  if (occurrences(source, patchSearch) != 1) {
    console.error('patch did not apply');
    process.exit(1);
  }

  if (!fs.existsSync(bakPath)) {
    console.log('writing backup to', path.relative('.', bakPath));
    fs.writeFileSync(bakPath, source);
  }

  const patchedSource = preamble + source.replace(patchSearch, patchReplace);

  fs.writeFileSync(filePath, patchedSource);
  console.log('patch applied');
}

function revert() {
  if (!fs.existsSync(bakPath)) {
    if (!test()) {
      console.log('source was not patched');
      return;
    }
    console.error('could not find backup file');
    process.exit(1);
  }
  const buffer = fs.readFileSync(bakPath);
  fs.writeFileSync(filePath, buffer);
  fs.unlinkSync(bakPath);
  console.log('patch successfully reverted');
}

function occurrences(string, searchString) {
  let count = 0;
  let idx = string.indexOf(searchString);
  while (idx >= 0) {
    count++;
    idx = string.indexOf(searchString, idx + 1);
  }
  return count;
}
