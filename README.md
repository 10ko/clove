# Clove

Orchestrate coding agents (local or Docker) with a CLI and dashboard.

**Requires [Bun](https://bun.sh)** (`curl -fsSL https://bun.sh/install | bash`).

## Commands

```bash
# Install dependencies
bun install

# Interactive shell (recommended)
bun run dev
# or: bun run src/cli.ts

# From the shell:
#   start --repo <path|url> [--prompt "<text>"] [--runtime local|docker] [--agent cursor]
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
bun run dev -- serve --port 3000
bun run dev -- dashboard
bun run dev -- list
bun run dev -- start --repo . --prompt "hello"
```

## Binary (macOS ARM)

To build a standalone executable and bundle the dashboard for distribution:

```bash
bun run build:binary
```

This produces `dist/clove-macos-arm64` and `dist/dashboard/dist/`. To distribute, zip the contents of `dist/` (the binary and the `dashboard/` folder must stay next to each other). On another Mac (Apple Silicon), run:

```bash
./clove-macos-arm64 serve    # API + dashboard at http://localhost:3000
./clove-macos-arm64 dashboard
./clove-macos-arm64 list
```

## Dashboard

Run `dashboard` from the interactive shell; the app opens in your browser and the API runs on port 3000.

## Commit and PR (worktrees)

With the **local** runtime, each agent uses a git worktree on a branch like `clove/agent-123`. You commit and open a PR yourself: go to the agent’s workspace (e.g. via the dashboard “VS Code” button), commit, push the branch, then open a PR. **Push before stopping the agent** — stopping removes the worktree and deletes the local branch. See [docs/workflow.md](docs/workflow.md).

## Docker runtime

Use `--runtime docker` with a **repo URL** (e.g. `https://github.com/org/repo`). The clone runs on the host, then the workspace is mounted into the container.

**Auth:** Clove does not handle credentials. For private repos use one of:

- **Token in URL:** `https://<token>@github.com/org/repo`
- **Host git config:** ensure `git clone` works in your terminal (credential helper, SSH keys); Clove uses the same `git` on the host.

Test with a public repo first.

## What’s next

- Test the Docker runtime with a public repo.
- Phase 6: config file, persistence, error handling, release prep (see `docs/plans/implementation.md`).
