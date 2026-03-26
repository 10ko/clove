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
  branchName?: string;
}

export interface StartAgentResult {
  path: string;
  branch: string;
  mainRepoRoot?: string;
  repoPath: string;
}

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

  async pauseAgent(agentId: AgentId): Promise<void> {
    return this.orchestrator.pauseAgent(agentId);
  }

  async resumeAgent(agentId: AgentId, prompt?: string): Promise<void> {
    return this.orchestrator.resumeAgent(agentId, prompt);
  }

  async deleteAgent(agentId: AgentId): Promise<void> {
    return this.orchestrator.deleteAgent(agentId);
  }

  /** @deprecated Use pauseAgent instead. */
  async stopAgent(agentId: AgentId): Promise<void> {
    return this.orchestrator.pauseAgent(agentId);
  }

  listAgents(): AgentRecord[] {
    return this.orchestrator.listAgents();
  }

  async *stream(agentId: AgentId): AsyncIterable<StreamEnvelope> {
    yield* this.orchestrator.streamLogs(agentId);
  }

  async sendInput(agentId: AgentId, input: string): Promise<void> {
    return this.orchestrator.sendInput(agentId, input);
  }

  async cancelAgent(agentId: AgentId): Promise<void> {
    return this.orchestrator.cancelAgent(agentId);
  }

  /** Pause all running agents (used during graceful shutdown). */
  async pauseAll(): Promise<void> {
    return this.orchestrator.pauseAll();
  }
}
