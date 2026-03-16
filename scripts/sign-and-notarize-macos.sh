#!/usr/bin/env bash
# Sign and notarize the macOS binary for distribution.
# Prerequisites: Apple Developer account, Developer ID Application cert, app-specific password.
# Sign and notarize for distribution outside the App Store.

set -e

BINARY="${1:-dist/clove-macos-arm64}"
DIST_DIR="$(dirname "$BINARY")"
BINARY_NAME="$(basename "$BINARY")"
ZIP_NAME="${BINARY_NAME}.zip"

if [[ "$(uname -s)" != Darwin ]]; then
  echo "This script runs only on macOS."
  exit 1
fi

if [[ ! -f "$BINARY" ]]; then
  echo "Binary not found: $BINARY"
  echo "Run: bun run build:binary"
  exit 1
fi

# Signing identity: set SIGNING_IDENTITY or auto-detect "Developer ID Application"
if [[ -z "${SIGNING_IDENTITY}" ]]; then
  SIGNING_IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | grep -oE '"Developer ID Application[^"]+"' | head -1 | tr -d '"')
  if [[ -z "$SIGNING_IDENTITY" ]]; then
    echo "No Developer ID Application certificate found."
    echo "Create one at https://developer.apple.com/account/resources/certificates/list"
    echo "Then set SIGNING_IDENTITY to the full name, e.g.:"
    echo '  export SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"'
    exit 1
  fi
  echo "Using identity: $SIGNING_IDENTITY"
fi

if [[ -z "${APPLE_ID}" || -z "${TEAM_ID}" || -z "${NOTARY_APP_PASSWORD}" ]]; then
  echo "Set Apple notarization credentials:"
  echo "  export APPLE_ID=your@email.com"
  echo "  export TEAM_ID=XXXXXXXX"
  echo "  export NOTARY_APP_PASSWORD=app-specific-password"
  echo "Create an app-specific password at https://account.apple.com/account/manage"
  exit 1
fi

echo "Signing $BINARY..."
codesign --timestamp --options runtime --force --sign "$SIGNING_IDENTITY" "$BINARY"

echo "Creating zip for notarization..."
cd "$DIST_DIR"
zip -q -r "$ZIP_NAME" "$BINARY_NAME" dashboard
cd - >/dev/null

echo "Submitting to Apple for notarization (this may take a few minutes)..."
xcrun notarytool submit "$DIST_DIR/$ZIP_NAME" \
  --wait \
  --apple-id "$APPLE_ID" \
  --team-id "$TEAM_ID" \
  --password "$NOTARY_APP_PASSWORD"

echo "Done. Notarized zip: $DIST_DIR/$ZIP_NAME"
echo "Distribute this zip to other Macs. Gatekeeper will accept it (no stapling needed for standalone binaries)."
