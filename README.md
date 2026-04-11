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
bun run dev          # starts daemon in foreground (shows logs)
```

Then in a second terminal:

```bash
bun run dev:cli      # interactive shell (connects to the daemon)
```

In the shell:

```
start --repo /path/to/your/repo --prompt "List the main files in this project"
list
stream <agent-id>
```

## Architecture

Clove runs as a **daemon** — a background HTTP server that manages agents. The CLI and dashboard are clients that talk to the daemon over HTTP.

- **Auto-start:** Running any `clove` command (including the interactive shell) will automatically start the daemon in the background if none is running.
- **State file:** `~/.clove/daemon.json` stores the daemon's PID and port.
- **Port selection:** Prefers port 3000; if taken, picks a free port automatically.

| Command | What it does |
|---|---|
| `clove` | Interactive shell (starts daemon if needed) |
| `clove daemon` | Ensure daemon is running, print its URL |
| `clove daemon --foreground` | Run daemon in foreground (for development) |
| `clove list` | One-shot: list agents |
| `clove start --repo . --prompt "..."` | One-shot: start an agent |
| `clove dashboard` | Open dashboard in browser |

**Environment variables:**

- `CLOVE_API_URL=http://localhost:PORT` — force the CLI to connect to a specific daemon URL.

## Development

```bash
bun install

# Terminal 1: daemon in foreground (see all logs)
bun run dev

# Terminal 2: interactive shell
bun run dev:cli

# Or just run the CLI directly (auto-starts daemon in background)
bun run src/cli.ts
```

### Shell commands

```
start --repo <path> [--prompt "<text>"] [--agent cursor] [--agent-id <id>] [--branch <name>]
list                                    List agents (running and sleeping)
stream <agent-id>                       Stream agent output (Ctrl+C to leave)
send-input <agent-id> "<input>"         Send input to agent
stop <agent-id>                         Pause agent (keeps workspace; use delete to remove)
dashboard                               Open dashboard in browser
help                                    Show help
exit, quit                              Exit shell
```

## Install (macOS ARM binary)

**Homebrew:**

```bash
brew tap 10ko/clove && brew install clove
```

**Or download manually** from [Releases](https://github.com/10ko/clove/releases), unzip, and run:

```bash
./clove-macos-arm64          # interactive shell (starts daemon automatically)
./clove-macos-arm64 list
./clove-macos-arm64 dashboard
```

No Bun required — the binary is self-contained.

## Build binary (macOS ARM)

```bash
bun run build:binary
```

Produces `dist/clove-macos-arm64` and `dist/clove-macos-arm64.zip`. Upload the zip to a GitHub Release; the update-homebrew-tap workflow updates the Homebrew formula.

## Dashboard

Run `dashboard` from the shell or `clove dashboard` from the command line. The dashboard connects to the running daemon automatically.

## Commit and PR (worktrees)

With the **local** runtime, each agent uses a git worktree on a branch like `clove/agent-123`. You commit and open a PR yourself: go to the agent's workspace (e.g. via the dashboard "VS Code" button), commit, push the branch, then open a PR. **Push before deleting the agent** — delete removes the worktree and deletes the local branch. Pausing only stops the process.

## What's next

- **Config file** — Defaults for runtime, agent, paths.
- **Desktop app** — Electron/Tauri wrapper for the dashboard.
- **Hosted control plane** — SaaS version of the daemon.

The plugin system is in place: add runtimes and agents by implementing the interfaces in `src/types.ts` and registering them in `src/server.ts`.
