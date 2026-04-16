#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/release.sh <version|major|minor|patch>

Example:
  ./scripts/release.sh patch
  ./scripts/release.sh minor
  ./scripts/release.sh 0.2.0

What this does:
  1) Updates package.json version
  2) Commits the version bump
  3) Creates git tag v<version>
  4) Builds release binary + zip asset
  5) Pushes commit and tag
  6) Creates a GitHub release from that tag and uploads zip

Requirements:
  - Clean git working tree
  - Bun installed (for build:binary)
  - gh CLI authenticated (gh auth status)
EOF
}

if [[ "${1:-}" == "" ]]; then
  usage
  exit 1
fi

INPUT="$1"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean. Commit or stash changes first."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "You are on branch '$CURRENT_BRANCH'. Switch to 'main' to release."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install from https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated. Run: gh auth login"
  exit 1
fi

echo "Pulling latest changes from origin/main..."
git pull --ff-only origin main

VERSION="$(node -e '
const fs = require("node:fs");
const path = "package.json";
const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
const input = process.argv[1];
const semver = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/;
const currentMatch = pkg.version.match(semver);
if (!currentMatch) {
  console.error(`Current package.json version is not semver: ${pkg.version}`);
  process.exit(1);
}
if (input === "major" || input === "minor" || input === "patch") {
  if (currentMatch[4]) {
    console.error(`Cannot bump ${input} from prerelease version ${pkg.version}. Use explicit version.`);
    process.exit(1);
  }
  let major = Number(currentMatch[1]);
  let minor = Number(currentMatch[2]);
  let patch = Number(currentMatch[3]);
  if (input === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (input === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  process.stdout.write(`${major}.${minor}.${patch}`);
  process.exit(0);
}
if (!semver.test(input)) {
  console.error(`Invalid version: ${input}`);
  console.error("Expected semver like 0.2.0 or keyword: major|minor|patch");
  process.exit(1);
}
process.stdout.write(input);
' "$INPUT")"

TAG="v${VERSION}"
ZIP_ASSET="dist/clove-macos-arm64.zip"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag already exists: $TAG"
  exit 1
fi

echo "Updating package.json version to $VERSION..."
node -e '
const fs = require("node:fs");
const path = "package.json";
const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
pkg.version = process.argv[1];
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
' "$VERSION"

echo "Committing version bump..."
git add package.json
git commit -m "chore(release): ${TAG}"

echo "Creating tag $TAG..."
git tag "$TAG"

echo "Building binary and zip asset..."
bun run build:binary

if [[ ! -f "$ZIP_ASSET" ]]; then
  echo "Expected asset not found: $ZIP_ASSET"
  exit 1
fi

echo "Pushing commit and tag..."
git push origin main
git push origin "$TAG"

echo "Creating GitHub release..."
gh release create "$TAG" \
  "$ZIP_ASSET" \
  --generate-notes \
  --title "$TAG"

echo "Release created: $TAG"
