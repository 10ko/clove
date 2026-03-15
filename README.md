# Clove

Orchestrate coding agents (local or Docker) with a CLI and dashboard.

## Commands

```bash
# Interactive shell (recommended)
npm run dev
# or: npx tsx src/cli.ts

# From the shell:
#   start --repo <path|url> --prompt "<text>" [--runtime local|docker] [--agent cursor]
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
npm run dev -- serve --port 3000
npm run dev -- dashboard
npm run dev -- list
npm run dev -- start --repo . --prompt "hello"
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
