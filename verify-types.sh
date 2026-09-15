#!/bin/sh

# Verify that both ESM and CJS TypeScript consumers can resolve types from the packed
# tarballs under moduleResolution=node16.
#
# This is deliberately run against `npm pack` output rather than the workspace: the
# top-level "exports" in each package.json point at build/ for local development, and it
# is publishConfig -- merged in only at pack time -- that describes what consumers see.
# The unit suite can't cover this either, since jest.resolver.js maps @spotify-confidence/*
# straight to src/.
#
# The .cts entry is the regression guard for #422: with no .d.cts for the "require"
# condition TypeScript either falls back to the ESM .d.ts and reports TS1479, or -- once
# the condition names a .d.cts that isn't shipped -- finds no declarations at all (TS7016).

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
PACKAGES="sdk react openfeature-web-provider openfeature-server-provider"

# explicit template: BSD mktemp ignores TMPDIR
WORK="$(mktemp -d "${TMPDIR:-/tmp}/verify-types.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

echo "Packing workspace packages..."
for NAME in $PACKAGES; do
  (cd "$ROOT/packages/$NAME" && yarn pack --out "$WORK/$NAME.tgz" >/dev/null)
done

cat > "$WORK/package.json" <<'EOF'
{
  "name": "verify-types",
  "private": true,
  "version": "0.0.0"
}
EOF

echo "Installing into a scratch consumer project..."
cd "$WORK"
# hermetic cache: this must not depend on, or write to, the developer's shared npm cache
npm install --no-audit --no-fund --cache "$WORK/.npm-cache" \
  ./sdk.tgz ./react.tgz ./openfeature-web-provider.tgz ./openfeature-server-provider.tgz \
  react@^18 @types/react@^18 \
  @openfeature/web-sdk@^1.0.3 @openfeature/server-sdk@^1.13.5 \
  @types/node@^22 typescript@5.1.6 >npm-install.log 2>&1 ||
  { cat npm-install.log; exit 1; }

# One .mts and one .cts per package. The importing file's extension decides which export
# condition TypeScript resolves through, so this covers both branches of the exports map.
for NAME in $PACKAGES; do
  case "$NAME" in
    sdk) SPECIFIER="@spotify-confidence/sdk" ;;
    *) SPECIFIER="@spotify-confidence/$NAME" ;;
  esac
  printf "import * as m from '%s';\nexport type T = typeof m;\n" "$SPECIFIER" > "$WORK/$NAME.mts"
  printf "import * as m from '%s';\nexport type T = typeof m;\n" "$SPECIFIER" > "$WORK/$NAME.cts"
done

for EXT in mts cts; do
  cat > "$WORK/react-usage.$EXT" <<'EOF'
import { createElement } from 'react';
import { ConfidenceClient, FlagBundle } from '@spotify-confidence/sdk';
import { ConfidenceProvider, useFlagDetails } from '@spotify-confidence/react';

declare const client: ConfidenceClient;
declare const bundle: FlagBundle;
createElement(ConfidenceProvider, {
  bundle,
  apply: flag => client.apply(bundle.resolveToken, flag),
});
export function Feature() {
  const details = useFlagDetails('checkout.enabled', false, { expose: false });
  const value: boolean = details.value;
  const expose: () => Promise<void> = details.expose;
  return { value, expose };
}
EOF
done

cat > "$WORK/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "module": "node16",
    "moduleResolution": "node16",
    "jsx": "react",
    "strict": true,
    "noEmit": true,

    // This test is about module resolution, not about type-checking our dependencies'
    // declarations (@bufbuild/protobuf, for one, needs a newer TS than we pin). Nothing
    // we care about is hidden: TS1479 and TS2307 are reported against the importing
    // .cts/.mts file, which is never skipped.
    "skipLibCheck": true
  },
  "include": ["*.mts", "*.cts"]
}
EOF

echo "Type-checking ESM (.mts) and CJS (.cts) entries under moduleResolution=node16..."
./node_modules/.bin/tsc -p tsconfig.json

echo "Checking the packed React API with React 19 types as well..."
npm install --no-audit --no-fund --cache "$WORK/.npm-cache" \
  react@^19 @types/react@^19 >npm-install-react19.log 2>&1 ||
  { cat npm-install-react19.log; exit 1; }
./node_modules/.bin/tsc -p tsconfig.json

echo "OK: all packages resolve types from both the import and require conditions."
