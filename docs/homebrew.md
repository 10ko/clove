# Distributing Clove via Homebrew

The formula installs the **self-contained macOS binary** (no Bun, no source build). Homebrew downloads the zip from the GitHub release and installs it.

## One-time setup: push the tap

The formula lives in the **homebrew-clove** repo (separate from this one). Create that repo, add `Formula/clove.rb` and a README there, then push. See [10ko/homebrew-clove](https://github.com/10ko/homebrew-clove) for the current formula.

**First release:** Build the binary, create the zip, and attach it to a GitHub Release so the formula can download it:

```bash
# In the clove repo
bun run build:binary
./scripts/zip-for-release.sh
```

Create a release (e.g. v0.1.0), upload the generated `clove-macos-arm64.zip`. The [update-homebrew-tap](../.github/workflows/update-homebrew-tap.yml) workflow will run and set the formula’s `url` and `sha256` to that asset. After that, `brew install clove` will work.

## User install

No Bun needed. Just tap and install:

```bash
brew tap 10ko/clove
brew install clove
```

Via SSH:

```bash
brew tap 10ko/clove git@github.com:10ko/homebrew-clove.git
brew install clove
```

Then:

```bash
clove
clove serve
clove list
```

## Updating the formula (new Clove version)

1. **Build and zip:** `bun run build:binary` then `./scripts/zip-for-release.sh`.
2. **Create a release** for the new tag and **upload** `clove-macos-arm64.zip` as an asset.
3. The [update-homebrew-tap](../.github/workflows/update-homebrew-tap.yml) workflow runs on release and updates the formula’s `url` and `sha256` in the tap repo. Users run `brew upgrade clove`.

**Secret:** In the clove repo, set `HOMEBREW_TAP_TOKEN` (PAT with write access to **homebrew-clove**) so the workflow can push the formula update.

## Private repos

If the **clove** repo or the **homebrew-clove** tap is private, users need a token so Homebrew can download the release zip:

```bash
export HOMEBREW_GITHUB_API_TOKEN="ghp_xxxxxxxxxxxx"
brew tap 10ko/clove
brew install clove
```

Or tap via SSH for the tap repo; the release zip still needs the token if the repo is private.
