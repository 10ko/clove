# Clove

Orchestrate coding agents with a CLI and dashboard.

## Prerequisites

- **[Bun](https://bun.sh)** — `curl -fsSL https://bun.sh/install | bash`
- **Cursor CLI** — for the default agent: `curl https://cursor.com/install -fsS | bash` (then `agent --version` to confirm)
- **Git** — a repo with at least one commit to run agents against

Binary (macOS ARM): no Bun needed; download the release zip or use Homebrew (see below).

## Quick start

```bash
git clone https://github.com/10ko/clove.git && cd clove
bun install
bun run dev
```

In the shell:

```
start --repo /path/to/your/repo --prompt "List the main files in this project"
list
stream <agent-id>
```

Or run the API + dashboard: `bun run dev -- serve` (it will pick a free port and print the URL).

**macOS ARM (no Bun):** Download the binary from [Releases](https://github.com/10ko/clove/releases) or `brew tap 10ko/clove && brew install clove`, then run `clove` or `clove serve`.

## Commands

```bash
# Install dependencies
bun install

# Interactive shell (recommended)
bun run dev
# or: bun run src/cli.ts

# From the shell:
#   start --repo <path> [--prompt "<text>"] [--agent cursor]
#   list
#   stream <agent-id>
#   send-input <agent-id> "<input>"
#   stop <agent-id>
#   dashboard    # opens browser, keeps shell
#   help
#   exit
```

```bash
# One-off (no shell)
bun run dev -- serve        # picks a free port
bun run dev -- dashboard
bun run dev -- list
bun run dev -- start --repo . --prompt "hello"
```

## Binary (macOS ARM)

To build a standalone executable and create the release zip:

```bash
bun run build:binary
```

This produces `dist/clove-macos-arm64`, `dist/dashboard/dist/`, and **`dist/clove-macos-arm64.zip`**. Upload that zip to a GitHub Release; the update-homebrew-tap workflow will update the formula.

**Distribute to other Macs:**

- **Homebrew:** Users run `brew tap 10ko/clove && brew install clove`. The formula fetches the zip from the latest release.
- **Standalone binary:** Optionally sign and notarize the binary before running `zip-for-release.sh`, then share the zip. Requires Apple Developer account for notarization.

Recipients unzip and run:

```bash
./clove-macos-arm64 serve    # API + dashboard at http://localhost:3000
./clove-macos-arm64 dashboard
./clove-macos-arm64 list
```

## Dashboard

Run `dashboard` from the interactive shell; the app opens in your browser and the API runs on port 3000.

## Commit and PR (worktrees)

With the **local** runtime, each agent uses a git worktree on a branch like `clove/agent-123`. You commit and open a PR yourself: go to the agent’s workspace (e.g. via the dashboard “VS Code” button), commit, push the branch, then open a PR. **Push before stopping the agent** — stopping removes the worktree and deletes the local branch.

## What’s next

- **Daemon** — Run Clove as a background daemon; CLI and dashboard connect to it. First run could auto-start the daemon so there’s a single entry point.
- **Persistence & recovery** — Persist agent list and workspace metadata so after a restart you can see what was running and recover or clean up workspaces.
- **Config file** — Defaults for runtime, agent, paths.

The plugin system is in place: add runtimes and agents by implementing the interfaces in `src/types.ts` and registering them in `src/cli.ts` and `src/server.ts`.
