#!/usr/bin/env bash
set -e

DIST="dist"
ZIP_NAME="clove-macos-arm64.zip"

if [[ ! -f "$DIST/clove-macos-arm64" ]]; then
  echo "Run first: bun run build:binary"
  exit 1
fi

cd "$DIST"
zip -q -r "$ZIP_NAME" clove-macos-arm64
cd - >/dev/null

echo "Created $DIST/$ZIP_NAME"
