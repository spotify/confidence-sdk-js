#!/bin/sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE="$(basename "$(pwd)")"

for FILE in ./dist/*.d.ts; do
  NAME=$(basename "$FILE" .d.ts)
  if [ "$NAME" = "index" ]; then
    API_NAME="$PACKAGE.d.ts"
  else
    API_NAME="$PACKAGE-$NAME.d.ts"
  fi
  API_FILE="$SCRIPT_DIR/api/$API_NAME"
  if [ "$1" = "--local" ]; then
    echo "Updating $API_NAME"
    cp "$FILE" "$API_FILE"
  elif [ ! -f "$API_FILE" ]; then
    echo "Missing api file $API_NAME"
    exit 1
  else
    echo "Validating $API_NAME"
    diff -u "$API_FILE" "$FILE"
  fi
done

