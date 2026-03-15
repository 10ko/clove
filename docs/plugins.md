# Adding runtimes and agent plugins

Clove supports multiple **runtimes** (where the agent runs) and **agent plugins** (which agent runs). You can add new ones by implementing the interfaces and registering them.

## Runtimes

A runtime implements `AgentRuntime` in `src/types.ts`:

```ts
interface AgentRuntime {
  start(agentId, workspacePath, agent, prompt): Promise<void>;
  stop(agentId): Promise<void>;
  streamLogs(agentId): AsyncIterable<string>;
  sendInput(agentId, input): Promise<void>;
}
```

- **start**: The orchestrator calls this with a workspace path (from the workspace manager) and the agent plugin. Run the agent (e.g. in a process or container) and feed its output into whatever `streamLogs` will yield.
- **stop**: Tear down the agent and release resources.
- **streamLogs**: Return an async iterable of log/agent output chunks. The local and Docker runtimes use a replay buffer so multiple consumers see the same output.
- **sendInput**: Deliver user input to the running agent (e.g. to the plugin’s `handleInput`). Optional for runtimes that don’t support it (e.g. Docker can no-op).

**Example:** See `src/plugins/runtime/local.ts` (in-process) and `src/plugins/runtime/docker.ts` (container with workspace mounted).

### Docker runtime and git auth

The Docker runtime uses the **remote** workspace path: the workspace manager runs `git clone <url>` **on the host** (not inside the container), then the clone is mounted into the container. So authentication is whatever your host’s `git` uses:

- **Public repos:** no auth.
- **Private repos:** use a URL with a token (e.g. `https://<token>@github.com/org/repo`) or ensure the host has git credentials configured (e.g. `credential.helper`, SSH keys) so that a plain `git clone <url>` in the same environment would succeed.

**Register:** In `src/cli.ts` and `src/server.ts`, add your runtime to the `runtimes` object passed to `Orchestrator`, e.g. `myRuntime: createMyRuntime()`.

---

## Agent plugins

An agent plugin implements `AgentPlugin` in `src/types.ts`:

```ts
interface AgentPlugin {
  run(prompt, context): Promise<string>;
  stream(prompt, context): AsyncIterable<string>;
  handleInput(input): Promise<void>;
}
```

- **run**: Run to completion and return the full output (e.g. collect from `stream`).
- **stream**: Yield output chunks (the runtime pipes these to the user). Can be long-lived if the agent keeps producing.
- **handleInput**: Called when the user sends input (e.g. from the dashboard). Use it to steer the agent or enqueue input.

**Context** has `workspacePath`, `agentId`, and optional extra fields.

**Example:** See `src/plugins/agent/cursor.ts` (Cursor CLI).

**Register:** In `src/cli.ts` and `src/server.ts`, add your plugin to the `plugins` object. Values are **factories** that return an `AgentPlugin`, e.g. `myAgent: () => createMyAgent()`.

### Cursor plugin

The **cursor** plugin uses **ACP (Agent Client Protocol)** by default: it runs `agent acp` and talks JSON-RPC over stdio. Follow-up input is sent as `session/prompt` messages, so the agent responds in the stream.

**Check if already installed:** run `agent --version`. If that works, you can skip the install.

**Install (only if not already installed):**

```bash
curl https://cursor.com/install -fsS | bash
```

Then use runtime **local** and agent **cursor** (e.g. from the dashboard or `--agent cursor` in the CLI). The plugin streams the CLI’s stdout/stderr. When you send input (dashboard or `send-input <id> "..."`), it is written to Cursor's stdin so the agent can respond. For one-shot mode without stdin, use `nonInteractive: true` in options.

---

## Workspace manager and runtimes

- **Local runtime:** The workspace manager creates a **git worktree** from the source repo (path) on a new branch. The runtime receives that path.
- **Remote / Docker:** The workspace manager **clones** the repo (URL) and creates a branch in the clone. The runtime receives the clone path (and can mount it into a container).

So for a new runtime that needs an isolated copy of the repo, use `runtimeType: 'remote'` and pass a `sourceRepo` of type `url` so the workspace manager clones and branches; then the runtime gets the clone path.

---

## CLI and API

- **CLI:** `start --repo <path-or-url> --prompt "..." [--runtime local|docker] [--agent cursor]`
- **API:** `POST /api/agents/start` body can include `runtimeKey`, `pluginKey`, and `repoUrl` (or `repoPath`).

Docker requires a repo **URL**; local accepts a path.
