#!/bin/sh

# Emit a .d.cts alongside each bundled .d.ts.
#
# Our packages are "type": "module", so a .d.ts is read as ESM declarations. A TypeScript
# consumer resolving the "require" condition under moduleResolution=node16 looks for a
# .d.cts sibling; without one it falls back to the ESM .d.ts and reports TS1479 ("the
# referenced file is an ECMAScript module and cannot be imported with 'require'").
#
# The content is identical to the .d.ts: rollup emits named exports in both the .mjs and
# .cjs bundles, and `export { X }` inside a .d.cts describes exactly that CJS shape.
#
# This runs at the end of the bundle step so it copies whatever is actually shipped -- for
# the sdk that is api-extractor's trimmed rollup, which overwrites rollup-plugin-dts' output.

set -e

for FILE in ./dist/*.d.ts; do
  [ -e "$FILE" ] || continue
  NAME=$(basename "$FILE" .d.ts)
  echo "Emitting $NAME.d.cts"
  cp "$FILE" "./dist/$NAME.d.cts"
done
