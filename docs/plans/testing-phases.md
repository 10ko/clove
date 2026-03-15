# How to Test All Phases

This guide describes how to verify each phase of the [implementation plan](./implementation.md). Run these from the project root (`clove/`).

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** (or pnpm/yarn)
- **git** (required for Phase 1+ workspace tests)

```bash
cd /path/to/clove
npm install
```

---

## Phase 0: Project bootstrap

**Checkpoint:** Project builds and the CLI shows help.

| Step | Command | Expected |
|------|---------|----------|
| Build | `npm run build` | Compiles without errors; `dist/` is created |
| CLI help | `npm start -- --help` or `npm run dev -- --help` | Prints usage with COMMANDS (start, stop, stream, send-input, list) |
| Lint | `npm run lint` | No ESLint errors |
| Format | `npm run format:check` | All files pass Prettier |
| Tests | `npm test` | All tests pass |

**One-liner:** `npm run build && npm start -- --help && npm run lint && npm run format:check && npm test`

---

## Phase 1: Core types and workspace manager

**Checkpoint:** Types and workspace logic are in place; unit tests pass.

| Step | Command | Expected |
|------|---------|----------|
| Tests | `npm test` | All tests pass, including `WorkspaceManager` tests (worktree create, artifacts, cleanup) |
| Build | `npm run build` | Success |
| Programmatic API | See ESM check below | Imports and instantiates `WorkspaceManager` |

**WorkspaceManager tests** require a real git repo: they create a temp dir, `git init`, then run worktree and artifact tests. No manual setup needed.

**ESM check** (project uses `"type": "module"`):

```bash
node --input-type=module -e "import { WorkspaceManager } from './dist/index.js'; const w = new WorkspaceManager(); console.log('WorkspaceManager OK');"
```

---

## Phase 2: One runtime + one agent plugin (local)

**Checkpoint:** You can start one local agent and see streaming and input.

| Step | Command | Expected |
|------|---------|----------|
| Tests | `npm test` | All tests pass, including integration test for start/stream/input/stop |
| Start agent | `npm run dev -- start --repo . --prompt "hello"` (or equivalent) | Agent starts; stream shows output (e.g. from echo plugin) |
| List | `npm run dev -- list` | Shows the running agent and status |
| Stream | `npm run dev -- stream <agent-id>` | Live stream of logs/agent output |
| Send input | `npm run dev -- send-input <agent-id> "some input"` | Input is delivered (echo or stub reflects it) |
| Stop | `npm run dev -- stop <agent-id>` | Agent stops; workspace can be cleaned up |

Exact CLI flags may vary; adjust to whatever the implementation uses (e.g. `--source-repo`, `--agent-id`).

---

## Phase 3: Unified API and streaming contract

**Checkpoint:** CLI and (optional) HTTP server use the same API; stream uses envelope format.

| Step | Command | Expected |
|------|---------|----------|
| Tests | `npm test` | All tests pass |
| CLI commands | `npm run dev -- list`, `start`, `stream`, `send-input`, `stop` | All work via the unified API |
| Stream format | Inspect stream output or test | Envelope format: `[log]` / `[agent]` or equivalent (`{ type, payload }`) |
| API docs | Check `docs/` or code for API contract | Stream envelope and command semantics are documented |
| (Optional) HTTP server | Start server, e.g. `npm run dev -- serve`; call `list` or `stream` via HTTP/SSE | Same behavior as CLI |

---

## Phase 4: Dashboard (live logs, status, input)

**Checkpoint:** Web UI lists agents, shows live stream, and can send input.

| Step | Command | Expected |
|------|---------|----------|
| Build dashboard | `npm run build` (or `npm run build:dashboard` if separate) | Dashboard assets build |
| Start server + dashboard | e.g. `npm run dev` or `npm start` | Server and dashboard are served |
| Open browser | Navigate to dashboard URL (e.g. `http://localhost:3000`) | Dashboard loads |
| List agents | Use UI | Agent list matches `clove list` |
| Live stream | Open an agent detail view | Stream updates in real time (SSE or WebSocket) |
| Send input | Use input box in UI and submit | Same effect as `clove send-input <id> "..."` |

---

## Phase 5: Additional runtimes and plugins

**Checkpoint:** You can choose runtime (e.g. Docker) and agent plugin (e.g. second stub); both work.

| Step | Command | Expected |
|------|---------|----------|
| Tests | `npm test` | Tests pass for local and (if feasible) Docker runtime |
| Start with Docker | e.g. `npm run dev -- start --runtime docker --repo <url> ...` | Agent runs in Docker; stream and input work |
| Start with second plugin | e.g. `npm run dev -- start --agent my-plugin ...` | Second plugin runs correctly |
| Docs | Read CONTRIBUTING or plugin docs | Instructions for adding a new runtime and a new agent plugin |

Docker tests may be skipped in CI if Docker is unavailable; document that.

### Testing the Cursor plugin

**1. Check if Cursor CLI is installed**

```bash
agent --version
```

- If you see a version (or help), the CLI is installed; skip to step 3.
- If you get "command not found", install it (step 2) or run step 2b to verify the "not installed" error.

**2. (Optional) Install Cursor CLI**

```bash
curl https://cursor.com/install -fsS | bash
```

Restart your terminal or run `hash -r` (bash) / `rehash` (zsh), then run `agent --version` again.

**2b. Test the "not installed" error**

Without installing, start an agent with the cursor plugin. You should get a clear error with the install command:

```bash
cd /path/to/clove
npm run dev
# In the shell:
start --repo . --prompt "say hi" --agent cursor
```

Expected: error like `Cursor CLI not found (command: agent). Install with: curl ...`

**3. Test from the CLI (interactive shell)**

Use a repo that has at least one commit (required for worktrees):

```bash
cd /path/to/clove
npm run dev
```

In the `clove>` prompt:

```text
start --repo . --prompt "list the files in the project root" --agent cursor
list
stream <agent-id>
```

You should see the Cursor CLI run in the workspace and stream its output. Repo path can be `.` (clove itself) or any other local repo path.

**4. Test from the dashboard**

```bash
npm run dev
# In the shell:
dashboard
```

In the browser: choose **Runtime: local**, **Agent: cursor**, set **Repo path** to `/path/to/clove` (or another repo), enter a prompt (e.g. "list files in the project root"), click **Start agent**. Open the agent and confirm the stream shows Cursor’s output.

**5. Compare with echo/delay**

Same steps but use `--agent echo` or `--agent delay` (no Cursor CLI required). Echo returns immediately; delay adds a short pause between lines. Confirms the plugin selection and streaming path work.

---

## Phase 6: Polish and production readiness

**Checkpoint:** Config, persistence, errors, and docs are in place; ready to release.

| Step | Command | Expected |
|------|---------|----------|
| Config | Create config file (e.g. `clove.config.json`); run CLI | Runtimes/plugins load from config |
| Persistence | Start agent, stop process, restart, run `list` | Agent list/status is restored (or documented as best-effort) |
| Errors | Trigger invalid usage (e.g. bad agent id, missing repo) | Clear error messages; no unhandled rejections |
| README | Read `README.md` | Quick start, config overview, how to extend |
| CONTRIBUTING | Read `CONTRIBUTING.md` | How to add runtime/agent plugin |
| Package | `npm pack` (dry run) | Package builds; `npm publish` is possible when ready |

---

## Quick reference: commands by phase

| Phase | Main commands |
|-------|----------------|
| 0 | `npm run build`, `npm start -- --help`, `npm test`, `npm run lint` |
| 1 | `npm test` (WorkspaceManager tests), `npm run build` |
| 2 | `npm test`, `npm run dev -- start ...`, `list`, `stream`, `send-input`, `stop` |
| 3 | `npm test`, all CLI commands, optional HTTP/SSE |
| 4 | Dashboard in browser; same API as CLI |
| 5 | `npm test`, start with `--runtime docker` and `--agent <name>` |
| 6 | Config file, restart persistence, README, CONTRIBUTING, `npm pack` |

---

## CI recommendation

For CI, run at minimum:

```bash
npm ci
npm run lint
npm run format:check
npm run build
npm test
```

Add Phase 2+ integration tests when they exist. Phase 5 Docker tests can be gated on `DOCKER_AVAILABLE` or similar to avoid flakiness in environments without Docker.
