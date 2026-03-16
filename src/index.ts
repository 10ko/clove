/**
 * Clove – multi-agent coding orchestrator.
 * Public API for programmatic use.
 */

export type {
  AgentId,
  AgentStatus,
  AgentContext,
  AgentPlugin,
  AgentRuntime,
  RuntimeType,
  SourceRepo,
  StreamEnvelope,
  WorkspaceResult,
} from './types.js';
export { WorkspaceManager } from './workspaceManager.js';
export type { WorkspaceManagerOptions, ArtifactKind } from './workspaceManager.js';
export { Orchestrator, getOrchestratorVersion } from './orchestrator.js';
export type { AgentRecord, OrchestratorOptions } from './orchestrator.js';
export { CloveApi } from './api.js';
export type { StartAgentParams, StartAgentResult } from './api.js';
export { createServer, runServer } from './server.js';
export { createCursorAgent } from './plugins/agent/cursor.js';
export type { CursorAgentOptions } from './plugins/agent/cursor.js';
export { createLocalRuntime } from './plugins/runtime/local.js';
