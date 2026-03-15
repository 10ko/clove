/**
 * Unified API layer: same surface for CLI and HTTP server.
 * Exposes orchestrator operations and stream as envelope format.
 */

import type {
  AgentId,
  SourceRepo,
  StreamEnvelope,
} from './types.js';
import type { AgentRecord, Orchestrator } from './orchestrator.js';

export type { AgentRecord, StreamEnvelope };

export interface StartAgentParams {
  agentId: string;
  sourceRepo: SourceRepo;
  runtimeKey: string;
  pluginKey: string;
  prompt: string;
  /** Optional branch segment (branch will be clove/<branchName>). Defaults to agentId. */
  branchName?: string;
}

export interface StartAgentResult {
  path: string;
  branch: string;
  mainRepoRoot?: string;
  repoPath: string;
}

/**
 * Unified API: wraps an Orchestrator and exposes stream as StreamEnvelope
 * so CLI and HTTP (SSE) can share the same contract.
 */
export class CloveApi {
  constructor(private readonly orchestrator: Orchestrator) {}

  async startAgent(params: StartAgentParams): Promise<StartAgentResult> {
    return this.orchestrator.startAgent(
      params.agentId,
      params.sourceRepo,
      params.runtimeKey,
      params.pluginKey,
      params.prompt,
      params.branchName != null ? { branchName: params.branchName } : undefined
    );
  }

  async stopAgent(agentId: AgentId): Promise<void> {
    return this.orchestrator.stopAgent(agentId);
  }

  listAgents(): AgentRecord[] {
    return this.orchestrator.listAgents();
  }

  /**
   * Stream agent output as envelope format (type + payload).
   * Types: 'log' (runtime/stderr), 'reasoning' (agent thinking), 'agent' (final answer).
   */
  async *stream(agentId: AgentId): AsyncIterable<StreamEnvelope> {
    yield* this.orchestrator.streamLogs(agentId);
  }

  async sendInput(agentId: AgentId, input: string): Promise<void> {
    return this.orchestrator.sendInput(agentId, input);
  }
}
