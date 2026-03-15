# Clove API contract

The same API is used by the CLI (in-process) and the HTTP server. The dashboard or other clients talk to the HTTP server.

## Stream envelope

All streamed output uses a **stream envelope** so consumers can tell log lines from agent output.

```ts
type StreamEnvelope =
  | { type: 'log'; payload: string }   // runtime stdout/stderr (e.g. Docker logs)
  | { type: 'agent'; payload: string }; // agent plugin output (tokens, messages)
```

- **`log`** — Reserved for runtime-level logs (process output, container logs). Not yet used by the local runtime.
- **`agent`** — Output from the agent plugin (e.g. streamed tokens). All current output is `agent`.

CLI: when you run `stream <agent-id>`, the CLI prints `envelope.payload` (so you see the same text). The type is available for UI to style or route differently.

## HTTP API

Base URL: `http://localhost:3000` (or `--port` when running `clove serve`). All JSON request/response use `Content-Type: application/json` unless noted.

### List agents

```
GET /api/agents
```

**Response:** `200`

```json
{
  "agents": [
    {
      "agentId": "agent-123",
      "status": "running",
      "workspacePath": "/path/to/worktree",
      "runtimeKey": "local",
      "pluginKey": "cursor",
      "agentState": "waiting"
    }
  ]
}
```

- **agentState** (optional): `"busy"` when a prompt turn is in flight, `"waiting"` when the agent is ready for input. Only present when the runtime supports it (e.g. local runtime; Cursor plugin sets it via ACP). Other agents can implement the same pattern using `context.agentStateRef`.

### Start agent

```
POST /api/agents/start
```

**Body:**

```json
{
  "repoPath": "/path/to/repo",
  "repoUrl": "https://github.com/org/repo",
  "prompt": "Add tests for auth",
  "agentId": "agent-123",
  "runtimeKey": "local",
  "pluginKey": "cursor"
}
```

- Use **repoPath** for a local path (local runtime), or **repoUrl** for a Git URL (required for Docker runtime).
- **runtimeKey**: `local` (default) or `docker`.
- **pluginKey**: `cursor` (only supported agent for now).
- **agentId**, **runtimeKey**, **pluginKey** are optional.

**Response:** `200`

```json
{
  "path": "/path/to/repo/.clove/worktrees/agent-123",
  "branch": "clove/agent-123",
  "mainRepoRoot": "/path/to/repo",
  "repoPath": "/path/to/repo"
}
```

**Errors:** `400` if `repoPath` or `prompt` missing.

### Stop agent

```
POST /api/agents/:id/stop
```

**Response:** `200` `{ "ok": true }`

### Send input

```
POST /api/agents/:id/input
```

**Body:**

```json
{
  "input": "continue with the next step"
}
```

**Response:** `200` `{ "ok": true }`

**Errors:** `400` if `input` missing.

### Stream (SSE)

```
GET /api/agents/:id/stream
```

**Response:** `200`, `Content-Type: text/event-stream`

Server-Sent Events; each event `data` is a JSON string of one `StreamEnvelope`:

```
data: {"type":"agent","payload":"...agent output...\n"}
data: {"type":"agent","payload":"Echo: Add tests\n"}
data: {"type":"agent","payload":"Done.\n"}
```

Client: parse each line starting with `data: ` as `JSON.parse(line.slice(6))` to get `{ type, payload }`.

## CORS

The server sends `Access-Control-Allow-Origin: *` so browser-based dashboards can call it from another origin.
