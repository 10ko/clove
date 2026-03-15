# Multi-Agent Orchestrator MVP Plan

## Objective
Build a TypeScript-based orchestrator for running multiple AI agents in parallel with:
- Live streaming of progress and logs.
- Interactive input for steering agents mid-task.
- Runtime-agnostic execution (local, Docker, cloud, etc.).
- Plugin system for different agent implementations (Cursor, Claude Code, in-house, etc.).
- Feature parity between CLI and UI.

## Components

### 1. Orchestrator Core
- Track agents: id, status, runtime, plugin, workspace.
- Provide unified API for CLI and dashboard.
- Manage workspace creation and artifact storage.
- Handle streaming logs and bidirectional input.

### 2. Runtime Plugin System
- Standard interface:
```ts
interface AgentRuntime {
  start(agentId: string, workspace: string, agent: AgentPlugin, prompt: string): Promise<void>;
  stop(agentId: string): Promise<void>;
  streamLogs(agentId: string): AsyncIterable<string>;
  sendInput(agentId: string, input: string): Promise<void>;
}
```
- Example runtimes: Local, Docker, EC2, Fly.io.
- Purpose: agents run in isolated environments agnostic to platform.

### 3. Agent Plugin System
- Standard interface:
```ts
interface AgentPlugin {
  run(prompt: string, context: any): Promise<string>;
  stream(prompt: string, context: any): AsyncIterable<string>;
  handleInput(input: string): Promise<void>;
}
```
- Examples: Cursor, Claude Code, OpenAI Codex, Custom in-house models.
- Purpose: abstract different AI providers while keeping orchestration agnostic.

### 4. Workspace / Artifact Manager
- Create per-agent workspaces.
- Store artifacts: logs, prompts, outputs, patches.
- Isolated per agent for safety and parallel execution.

### 5. Streaming & Communication
- Use WebSockets or SSE for UI streaming.
- CLI consumes same API for logs and input.
- All outputs from agent plugins flow through orchestrator → CLI/UI.

### 6. CLI & Dashboard
- CLI commands: start, stop, stream, send-input, list.
- Dashboard: live logs, agent status, interaction panel.
- Unified orchestrator API ensures feature parity.

## Folder Structure
```
agent-orchestrator/
├─ src/
│  ├─ orchestrator.ts
│  ├─ cli.ts
│  ├─ dashboard/
│  ├─ plugins/
│  │   ├─ runtime/
│  │   └─ agent/
│  └─ workspaceManager.ts
├─ package.json
├─ tsconfig.json

