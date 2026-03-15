/**
 * Orchestrator core: track agents, manage workspaces, expose unified API for CLI and dashboard.
 */

import type {
  AgentId,
  AgentRuntime,
  AgentState,
  AgentStatus,
  SourceRepo,
} from './types.js';
import type { WorkspaceManager } from './workspaceManager.js';

export interface AgentRecord {
  agentId: AgentId;
  status: AgentStatus;
  workspacePath: string;
  runtimeKey: string;
  pluginKey: string;
  /** Agent phase: busy (prompt in flight) or waiting (ready for input). Only set when runtime supports it. */
  agentState?: AgentState;
}

export interface OrchestratorOptions {
  workspaceManager: WorkspaceManager;
  runtimes: Record<string, AgentRuntime>;
  plugins: Record<string, () => import('./types.js').AgentPlugin>;
}

export class Orchestrator {
  private readonly workspaceManager: WorkspaceManager;
  private readonly runtimes: Record<string, AgentRuntime>;
  private readonly plugins: Record<string, () => import('./types.js').AgentPlugin>;
  private readonly agents = new Map<AgentId, AgentRecord>();

  constructor(options: OrchestratorOptions) {
    this.workspaceManager = options.workspaceManager;
    this.runtimes = options.runtimes;
    this.plugins = options.plugins;
  }

  /**
   * Start an agent: create workspace, run runtime + plugin.
   * Uses registered runtimes and plugins (e.g. local + cursor).
   */
  async startAgent(
    agentId: AgentId,
    sourceRepo: SourceRepo,
    runtimeKey: string,
    pluginKey: string,
    prompt: string,
    options?: { branchName?: string }
  ): Promise<{
    path: string;
    branch: string;
    mainRepoRoot?: string;
    repoPath: string;
  }> {
    if (this.agents.has(agentId)) {
      throw new Error(`Agent already exists: ${agentId}`);
    }
    const runtime = this.runtimes[runtimeKey];
    const pluginFactory = this.plugins[pluginKey];
    if (!runtime || !pluginFactory) {
      throw new Error(`Unknown runtime "${runtimeKey}" or plugin "${pluginKey}"`);
    }
    const runtimeType = runtimeKey === 'local' ? 'local' : 'remote';
    const { path: workspacePath, branch, mainRepoRoot } =
      await this.workspaceManager.createWorkspace(
        agentId,
        sourceRepo,
        runtimeType,
        options
      );
    this.agents.set(agentId, {
      agentId,
      status: 'running',
      workspacePath,
      runtimeKey,
      pluginKey,
    });
    const plugin = pluginFactory();
    await runtime.start(agentId, workspacePath, plugin, prompt);
    const repoPath =
      sourceRepo.type === 'path' ? sourceRepo.path : sourceRepo.url;
    return { path: workspacePath, branch, mainRepoRoot, repoPath };
  }

  async stopAgent(agentId: AgentId): Promise<void> {
    const record = this.agents.get(agentId);
    if (!record) {
      return;
    }
    const runtime = this.runtimes[record.runtimeKey];
    if (runtime) {
      await runtime.stop(agentId);
    }
    await this.workspaceManager.removeWorkspace(agentId);
    this.agents.delete(agentId);
  }

  getAgentStatus(agentId: AgentId): AgentStatus | undefined {
    return this.agents.get(agentId)?.status;
  }

  /** Get full record for an agent, including agentState if the runtime supports it. */
  getAgentRecord(agentId: AgentId): AgentRecord | undefined {
    const record = this.agents.get(agentId);
    if (!record) return undefined;
    return this.enrichWithAgentState(record);
  }

  listAgents(): AgentRecord[] {
    return Array.from(this.agents.values()).map((r) => this.enrichWithAgentState(r));
  }

  private enrichWithAgentState(record: AgentRecord): AgentRecord {
    const runtime = this.runtimes[record.runtimeKey];
    const state = runtime?.getAgentState?.(record.agentId);
    if (state?.agentState == null) return record;
    return { ...record, agentState: state.agentState };
  }

  /**
   * Stream logs/agent output for an agent. Returns async iterable; empty if agent unknown.
   */
  streamLogs(agentId: AgentId): AsyncIterable<string> {
    const record = this.agents.get(agentId);
    if (!record) {
      return (async function* () {})();
    }
    const runtime = this.runtimes[record.runtimeKey];
    if (!runtime) {
      return (async function* () {})();
    }
    return runtime.streamLogs(agentId);
  }

  async sendInput(agentId: AgentId, input: string): Promise<void> {
    const record = this.agents.get(agentId);
    if (!record) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    const runtime = this.runtimes[record.runtimeKey];
    if (!runtime) {
      throw new Error(`Runtime not found: ${record.runtimeKey}`);
    }
    await runtime.sendInput(agentId, input);
  }
}

export function getOrchestratorVersion(): string {
  return '0.1.0';
}
