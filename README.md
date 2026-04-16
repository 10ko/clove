# Clove

Run multiple coding agents like a tiny mission control.

- `clove` gives you a fast REPL for launching and steering agents.
- `clove dashboard` gives you a live control view in the browser.
- Start any command and Clove spins up the daemon automatically.

## Install

### Option A: Homebrew (macOS ARM)

```bash
brew tap 10ko/clove
brew install clove
```

### Option B: Download binary (macOS ARM)

Download from [Releases](https://github.com/10ko/clove/releases), unzip, then run:

```bash
./clove-macos-arm64
```

### Option C: Run from source

Prerequisites:

- **[Bun](https://bun.sh)**
- **Cursor CLI** (`agent --version` to verify)
- **Git** repo with at least one commit

```bash
git clone https://github.com/10ko/clove.git
cd clove
bun install
bun run src/cli.ts
```

## First 60 Seconds

Open the REPL:

```bash
clove
```

In the `clove>` prompt:

```bash
start --repo . --prompt "Add tests for the parser"
list
stream <agent-id>
```

Press `Ctrl+C` to stop streaming and return to the prompt.

## Most Common Commands

### In the REPL (`clove>`)

- `start --repo <path> [--agent-id <id>] [--branch <name>] [--prompt "<text>"] [--runtime local] [--agent cursor]`
- `list`
- `stream <agent-id>`
- `send-input <agent-id> "<input>"`
- `stop <agent-id>` / `pause <agent-id>`
- `resume <agent-id>`
- `delete <agent-id>`
- `dashboard`
- `help` / `exit` / `quit`

### One-shot mode (no REPL)

```bash
clove start --repo . --prompt "Refactor CLI help generation"
clove list
clove stream <agent-id>
clove stop <agent-id>
clove resume <agent-id>
clove delete <agent-id>
clove dashboard
```

Use `clove --help` for full command help.

## Daemon Commands

```bash
clove daemon                  # ensure daemon is running and print URL
clove daemon status           # show PID, port, and health
clove daemon stop             # stop background daemon
clove daemon --foreground     # run daemon in foreground (dev mode)
```

Daemon state is stored in `~/.clove/daemon.json`.

## Dashboard

- Launch from REPL: `dashboard`
- Launch as one-shot: `clove dashboard`

The dashboard connects to the currently running daemon automatically.

## Agent Worktrees (important)

With the local runtime, each agent runs in its own git worktree and branch (for example `clove/agent-123`).

- Pause with `stop` / `pause` to keep workspace.
- Resume with `resume`.
- Delete with `delete` to remove workspace and local branch.
- Push your branch before deleting an agent if you want to keep remote history.

## Development (contributors)

```bash
bun install

# Terminal 1: daemon logs in foreground
bun run dev

# Terminal 2: interactive CLI
bun run dev:cli
```

Useful scripts:

- `bun run build`
- `bun run lint`
- `bun run test`
- `bun run dashboard:dev`
- `bun run build:binary` (outputs `dist/clove-macos-arm64` and `dist/clove-macos-arm64.zip`)
