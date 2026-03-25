/**
 * Shared CLI API interface for the Clove daemon HTTP client.
 */

import type { AgentId, StreamEnvelope } from './types.js';
import type { AgentRecord } from './orchestrator.js';
import type { StartAgentParams, StartAgentResult } from './api.js';

export interface CliApi {
  listAgents(): Promise<AgentRecord[]>;
  startAgent(params: StartAgentParams): Promise<StartAgentResult>;
  stopAgent(agentId: AgentId): Promise<void>;
  stream(agentId: AgentId): AsyncIterable<StreamEnvelope>;
  sendInput(agentId: AgentId, input: string): Promise<void>;
}
