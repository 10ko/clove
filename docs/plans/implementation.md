# Implementation Plan: Multi-Agent Orchestrator (Clove)

This document turns the [init.md](./init.md) vision into a phased implementation plan. Each phase has clear outcomes and dependencies so we can ship incrementally and validate design choices early.

---

## Design Notes & Open Questions

Before locking phases, a few clarifications from the init plan:

1. **Orchestrator ↔ Runtime ↔ Agent**  
   Flow is: *Orchestrator* chooses a *Runtime* (where the agent runs) and an *Agent Plugin* (which AI/tool runs). The runtime’s `start()` receives the agent plugin and invokes it (e.g. `agent.stream(prompt, context)`). We’ll implement the core with this flow and one runtime + one agent plugin to validate the interfaces.

2. **Streaming shape**  
   Init mentions both “streaming logs” and agent output. For the API we can treat:
   - **Logs**: stdout/stderr from the process/sandbox (runtime responsibility).
   - **Agent output**: tokens or messages from the agent plugin (plugin responsibility).  
   Both can be multiplexed on the same stream with a simple envelope (e.g. `{ type: 'log' | 'agent', payload }`) so CLI and UI stay identical.

3. **Workspace semantics (source repo + isolation)**  
   The user runs Clove *against* a repo (the project they want agents to work on). Each agent needs an isolated copy of that repo so edits don’t touch the user’s working directory and can be reviewed/merged later.
   - **Local runtime:** use **git worktrees**. Create a worktree from the user’s repo on a new branch (e.g. `clove/<agentId>` or `clove/<timestamp>-<id>`). One worktree per agent; no full clone, shared objects.
   - **Remote/Docker (and similar) runtimes:** **clone the repo** (user provides URL or path is synced), then **branch off** (e.g. same branch naming). The runtime gets a clean environment in the clone.
   Artifact storage (logs, prompts, outputs, patches) lives inside or alongside that workspace directory. The Workspace Manager is responsible for: resolving the source repo, creating the branch + worktree or clone, and returning the workspace path to the orchestrator/runtime.

4. **Name**  
   Project name: **clove**. Repo root is the project root.

---

## Phase 0: Project bootstrap

**Goal:** TypeScript project, lint/test/build, and the folder structure from init (adapted to repo root).

**Tasks:**

- [x] Init Node/TypeScript project (`package.json`, `tsconfig.json`, optional `vitest` or `jest`).
- [x] Add ESLint + Prettier (or shared config).
- [x] Create folder structure:
  ```
  src/
  ├── orchestrator.ts      # Core orchestrator (stub or minimal)
  ├── cli.ts               # CLI entry (stub)
  ├── dashboard/           # Reserved for UI
  ├── plugins/
  │   ├── runtime/         # Runtime plugin implementations
  │   └── agent/           # Agent plugin implementations
  └── workspaceManager.ts  # Workspace + artifact paths (stub)
  ```
- [x] Scripts: `build`, `test`, `lint`, `dev` (e.g. ts-node or tsx for CLI).

**Outcome:** Clean repo that builds and runs a no-op CLI (e.g. `clove --help`).

---

## Phase 1: Core types and workspace manager

**Goal:** Define the plugin and runtime interfaces, and the workspace strategy (worktree vs clone). No real execution yet.

**Tasks:**

- [x] **Interfaces (e.g. `src/types.ts` or under `src/plugins/`):**
  - [x] `AgentPlugin`: `run`, `stream`, `handleInput` (and any shared context type).
  - [x] `AgentRuntime`: `start`, `stop`, `streamLogs`, `sendInput`.
  - [x] Shared types: agent id, status, workspace path, stream envelope (log vs agent).
- [x] **Workspace manager (source repo + isolation):**
  - [x] **Input:** source repo (path for local, or URL for remote), agent id, runtime type (local vs remote).
  - [x] **Local:** create a **git worktree** from the source repo on a new branch (e.g. `clove/<agentId>`); return worktree path. Require a git repo; document branch naming and worktree base path (e.g. configurable or under `~/.clove/worktrees/` or project-local).
  - [x] **Remote (stub or minimal):** contract for “prepare workspace” that would clone + branch (full impl in Phase 5 with Docker runtime). For Phase 1, define the interface: e.g. `createWorkspace(agentId, sourceRepo, runtimeType)` → `{ path, branch }`.
  - [x] Artifact paths under workspace (or alongside): `logs/`, `prompts/`, `outputs/`, `patches/` (or single `artifacts/` with subdirs). API: `getWorkspacePath(agentId)`, `writeArtifact(agentId, kind, name, data)`, and cleanup when agent is removed.
- [x] Unit tests for workspace creation (local worktree + branch), artifact paths, and cleanup.

**Outcome:** Types and workspace logic that the rest of the system will use; no side effects beyond the filesystem.

---

## Phase 2: One runtime + one agent plugin (local)

**Goal:** Single runtime (local process) and one agent plugin (e.g. stub or “echo”) so we can run one agent and see streaming and inputs end-to-end.

**Tasks:**

- [x] **Local runtime (`plugins/runtime/local.ts`):**
  - [x] Receives workspace path from orchestrator (already a git worktree on a branch, created by workspace manager).
  - [x] Spawns/runs the agent plugin in the same process (or subprocess if we prefer isolation from day one).
  - [x] Implements `start(agentId, workspace, agent, prompt)`: use given workspace path, call `agent.stream(prompt, context)`, pipe output into `streamLogs` (or a combined stream).
  - [x] Implements `stop`, `streamLogs`, `sendInput` (input queue or callback into the agent’s `handleInput`).
- [x] **Stub or echo agent (`plugins/agent/echo.ts` or `stub.ts`):**
  - [x] Implements `AgentPlugin`: `stream` yields lines or tokens; `handleInput` stores or echoes back. No real AI.
- [x] **Orchestrator minimal implementation:**
  - [x] Register one agent: id, status, runtime, plugin, workspace path.
  - [x] `startAgent(agentId, runtimeKey, agentKey, prompt)` → create workspace, get runtime + plugin, call `runtime.start(...)`.
  - [x] `stopAgent(agentId)`, `getAgentStatus(agentId)`, and a way to get the runtime’s stream for that agent (for CLI/UI).
- [x] Integration test: start one agent, consume stream, send input, stop, assert workspace and artifacts exist.

**Outcome:** One agent runnable locally with streaming and input, and a clear pattern for adding more runtimes/plugins.

---

## Phase 3: Unified API and streaming contract

**Goal:** Single API (used by both CLI and future dashboard) for starting/stopping agents, subscribing to streams, and sending input. Decouple “transport” (stdio, HTTP, WebSocket) from the core.

**Tasks:**

- [x] **Orchestrator API layer (e.g. `src/api.ts` or `src/server.ts`):**
  - [x] Commands: `start`, `stop`, `stream`, `send-input`, `list` (as in init).
  - [x] Stream endpoint: unified stream (logs + agent output) with envelope format; CLI and UI both consume this.
- [x] **Transport options:**
  - [x] **CLI:** Direct in-process calls to orchestrator + stream read (e.g. async iterable over stdout or a local socket). No HTTP required for CLI-only.
  - [x] **Future UI:** Same API over HTTP + SSE or WebSockets. For this phase, we can add a minimal HTTP server that exposes the same commands and one SSE (or WS) stream endpoint.
- [x] **CLI implementation:**
  - [x] Commands: `start`, `stop`, `stream`, `send-input`, `list` calling the unified API.
  - [x] Stream: print or format the unified stream (e.g. prefix by type: `[log]` / `[agent]`).
- [x] Document the stream envelope and API contract (for dashboard work later).

**Outcome:** Feature parity between “CLI using API” and “UI using API” is possible; CLI is fully usable for one local agent.

---

## Phase 4: Dashboard (live logs, status, input)

**Goal:** Simple UI that uses the same API: list agents, show live stream, send input.

**Tasks:**

- [x] Choose stack (e.g. Vite + React, or Next.js; SSE or WebSocket for stream).
- [x] Dashboard pages/components:
  - [x] Agent list (from `list`), status per agent.
  - [x] Detail view: live logs + agent output stream, input box for `send-input`.
- [x] Connect to unified API (HTTP + SSE/WS); reuse same envelope format as CLI.
- [x] Optional: `start` from UI (select runtime/plugin, prompt).

**Outcome:** CLI and dashboard both use the same orchestrator API; we can demo one agent from both.

---

## Phase 5: Additional runtimes and plugins

**Goal:** Validate plugin system with at least one more runtime (e.g. Docker) and one more agent (e.g. real integration or another stub).

**Tasks:**

- [x] **Docker runtime (or similar):**
  - [ ] Workspace manager “remote” path: clone the user’s repo, create branch (same naming as worktree), use that directory as workspace path (or hand off to runtime for in-container clone).
  - [x] Implement `AgentRuntime` by starting a container with the workspace mounted (or clone inside container); run the agent inside the container; stream logs and forward input.
  - [x] Configuration: image, mounts, env (e.g. in config file or env vars).
- [x] **Second agent plugin:**
  - [x] e.g. wrapper around an existing CLI (Cursor, Claude Code, etc.) or another stub that mimics delay/failure.
- [x] Orchestrator: discovery or registry of runtimes and plugins by key; CLI/UI can choose “local” vs “docker”, “echo” vs “cursor”, etc.
- [x] Document how to add a new runtime and a new agent plugin.

**Outcome:** Multi-runtime and multi-agent by configuration; path clear for Cursor/Claude/Codex plugins.

---

## Phase 6: Polish and production readiness

**Goal:** Config file, error handling, persistence, and docs so others can run and extend the tool.

**Tasks:**

- [ ] **Configuration:** Config file (e.g. YAML/JSON) for runtimes and plugins (paths, env, Docker image, etc.).
- [ ] **Persistence:** Agent list and status survive process restart (e.g. SQLite or JSON under workspace root).
- [ ] **Errors:** Clear errors from orchestrator, runtime, and plugins; timeouts and cleanup on `stop`.
- [ ] **Docs:** README (quick start, config, extending with plugins), CONTRIBUTING (how to add runtime/agent), and architecture diagram.
- [ ] **Release:** Package for npm (or binary via `pkg`/`nexe` if desired), version and changelog.

**Outcome:** Open-source-ready MVP that supports multiple agents, runtimes, and plugins with CLI and UI.

---

## Suggested order and checkpoints

| Phase | Depends on | Checkpoint |
|-------|------------|------------|
| 0     | —          | `pnpm run build` and `clove --help` |
| 1     | 0          | Types + workspace manager with tests |
| 2     | 1          | `clove start` runs one local agent with stream + input |
| 3     | 2          | `clove list`, `clove stream`, `clove send-input` via unified API |
| 4     | 3          | Dashboard shows same agent and stream |
| 5     | 3          | Docker runtime + second plugin; choose at start |
| 6     | 4, 5       | Config, persistence, docs, release |

Phases 4 and 5 can be parallelized once Phase 3 is done.

---

## What we can do next

1. **Adjust phases:** Merge, split, or reorder (e.g. move “unified API” earlier or add a “config file” stub in Phase 0).
2. **Lock design choices:** Confirm stream envelope format, workspace layout, and repo/folder naming.
3. **Start coding:** Begin with Phase 0 (bootstrap) and Phase 1 (types + workspace) so we have a solid base.

Tell me which of these you want to tackle first (e.g. “start Phase 0” or “change the streaming design”) and we can go step by step.
