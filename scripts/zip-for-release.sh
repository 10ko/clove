#!/usr/bin/env bash
# Create clove-macos-arm64.zip from dist/ for uploading to a GitHub Release.
# Run after: bun run build:binary
# Then create a release, upload the zip, and the update-homebrew-tap workflow will update the formula.

set -e

DIST="dist"
ZIP_NAME="clove-macos-arm64.zip"

if [[ ! -f "$DIST/clove-macos-arm64" ]]; then
  echo "Run first: bun run build:binary"
  exit 1
fi

cd "$DIST"
zip -q -r "../$ZIP_NAME" clove-macos-arm64 dashboard
cd - >/dev/null

echo "Created $ZIP_NAME"
echo "Upload it to your GitHub Release, then the Homebrew tap will be updated automatically (or run the update-homebrew-tap workflow)."
