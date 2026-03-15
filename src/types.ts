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

/** Envelope for multiplexed streams: logs from runtime vs output from agent. */
export type StreamEnvelope =
  | { type: 'log'; payload: string }
  | { type: 'agent'; payload: string };

/** Context passed to agent plugins (workspace path, env, etc.). */
export interface AgentContext {
  workspacePath: string;
  agentId: string;
  [key: string]: unknown;
}

/**
 * Agent plugin: abstracts different AI providers (Cursor, Claude Code, etc.).
 * The runtime invokes run/stream and forwards handleInput for interactive steering.
 */
export interface AgentPlugin {
  run(prompt: string, context: AgentContext): Promise<string>;
  stream(prompt: string, context: AgentContext): AsyncIterable<string>;
  /** Handle user input. agentId is provided so plugins can route to the right process. Return a string to append to the stream. */
  handleInput(agentId: AgentId, input: string): Promise<void | string>;
}

/**
 * Runtime plugin: where the agent runs (local process, Docker, cloud).
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
  streamLogs(agentId: AgentId): AsyncIterable<string>;
  sendInput(agentId: AgentId, input: string): Promise<void>;
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
