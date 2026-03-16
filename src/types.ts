/**
 * Shared types for the orchestrator, runtimes, and agent plugins.
 */

/** Unique identifier for an agent run. */
export type AgentId = string;

/** Runtime type: local (worktree) vs remote (clone + branch). */
export type RuntimeType = 'local' | 'remote';

/** Agent lifecycle status. */
export type AgentStatus =
  | 'pending'
  | 'running'
  | 'stopped'
  | 'failed'
  | 'completed';

/** Envelope for multiplexed streams: logs, reasoning, agent answer, and user message. */
export type StreamEnvelope =
  | { type: 'log'; payload: string }
  | { type: 'reasoning'; payload: string }
  | { type: 'agent'; payload: string }
  | { type: 'user'; payload: string };

/** Agent phase: busy (prompt in flight) vs waiting (ready for input). Can be implemented by any agent (e.g. ACP). */
export type AgentState = 'busy' | 'waiting';

/** Ref for plugins to report agent state so orchestrator can expose it. */
export interface AgentStateRef {
  current: AgentState;
}

/** Context passed to agent plugins (workspace path, env, etc.). */
export interface AgentContext {
  workspacePath: string;
  agentId: string;
  /** Optional: set by runtime so plugins can report busy/waiting. */
  agentStateRef?: AgentStateRef;
  /** Optional: when aborted, plugin should exit stream and clean up (e.g. kill child). */
  abortSignal?: AbortSignal;
  [key: string]: unknown;
}

/**
 * Agent plugin: abstracts different AI providers (Cursor, Claude Code, etc.).
 * The runtime invokes run/stream and forwards handleInput for interactive steering.
 */
export interface AgentPlugin {
  run(prompt: string, context: AgentContext): Promise<string>;
  stream(prompt: string, context: AgentContext): AsyncIterable<StreamEnvelope>;
  /** Handle user input. agentId is provided so plugins can route to the right process. Return a string to append to the stream. */
  handleInput(agentId: AgentId, input: string): Promise<void | string>;
  /** Cancel the current prompt turn (e.g. send ACP session/cancel). Optional. */
  cancel?(agentId: AgentId): Promise<void>;
}

/**
 * Runtime plugin: where the agent runs (local process, container, cloud, etc.).
 * Receives workspace path (from workspace manager) and agent plugin; manages process and I/O.
 */
export interface AgentRuntime {
  start(
    agentId: AgentId,
    workspacePath: string,
    agent: AgentPlugin,
    prompt: string
  ): Promise<void>;
  stop(agentId: AgentId): Promise<void>;
  streamLogs(agentId: AgentId): AsyncIterable<StreamEnvelope>;
  sendInput(agentId: AgentId, input: string): Promise<void>;
  /** Optional: cancel current prompt turn (e.g. Ctrl+C). */
  cancel?(agentId: AgentId): Promise<void>;
  /** Optional: agent state (e.g. busy vs waiting). Used by CLI/API for display. */
  getAgentState?(agentId: AgentId): { agentState?: AgentState } | undefined;
}

/** Source repo for workspace creation: path (local) or URL (remote). */
export type SourceRepo = { type: 'path'; path: string } | { type: 'url'; url: string };

/** Result of creating a workspace: path and branch name. */
export interface WorkspaceResult {
  path: string;
  branch: string;
  /** Main repo root (local worktrees only), for cleanup when stopping from another process. */
  mainRepoRoot?: string;
}
