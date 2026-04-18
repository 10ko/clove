#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
ZIP_NAME="clove-macos-arm64.zip"

if [[ ! -f "$DIST/clove-macos-arm64" ]]; then
  echo "Run first: bun run build:binary"
  exit 1
fi

if [[ ! -f "$ROOT/dashboard/dist/index.html" ]]; then
  echo "Run first: bun run dashboard:build (missing dashboard/dist)"
  exit 1
fi

cd "$DIST"
rm -f "$ZIP_NAME"
zip -q -r "$ZIP_NAME" clove-macos-arm64
cd "$ROOT"
zip -qr "$DIST/$ZIP_NAME" dashboard/dist

echo "Created $DIST/$ZIP_NAME (binary + dashboard/dist for disk fallback)"
