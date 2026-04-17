/**
 * Orchestrator core: track agents, manage workspaces, persist state via store.
 *
 * Agent lifecycle:
 *   start  → running  (create worktree, start process, persist)
 *   pause  → sleeping (terminate process, keep worktree, persist)
 *   resume → running  (restart process on existing worktree, persist)
 *   delete → gone     (terminate process, remove worktree, remove from DB)
 */

import type {
  AgentId,
  AgentPlugin,
  AgentRuntime,
  AgentState,
  AgentStatus,
  SourceRepo,
  StreamEnvelope,
} from './types.js';
import type { WorkspaceManager } from './workspaceManager.js';
import type { WorkspaceStore } from './store.js';

export type PersistentStatus = 'running' | 'sleeping';

export interface AgentRecord {
  agentId: AgentId;
  status: PersistentStatus;
  workspacePath: string;
  branch: string;
  runtimeKey: string;
  pluginKey: string;
  sourceRepo: SourceRepo;
  mainRepoRoot?: string;
  prompt: string;
  /** Cursor CLI `--model` when set at start. */
  model?: string;
  sessionId?: string;
  agentState?: AgentState;
  createdAt?: string;
}

/** Passed to plugin factories (e.g. Cursor `agent --model`). */
export interface PluginFactoryOpts {
  model?: string;
}

export type PluginFactory = (opts?: PluginFactoryOpts) => AgentPlugin;

export interface OrchestratorOptions {
  workspaceManager: WorkspaceManager;
  runtimes: Record<string, AgentRuntime>;
  plugins: Record<string, PluginFactory>;
  store?: WorkspaceStore;
}

export class Orchestrator {
  private readonly workspaceManager: WorkspaceManager;
  private readonly runtimes: Record<string, AgentRuntime>;
  private readonly plugins: Record<string, PluginFactory>;
  private readonly store?: WorkspaceStore;
  private readonly agents = new Map<AgentId, AgentRecord>();

  constructor(options: OrchestratorOptions) {
    this.workspaceManager = options.workspaceManager;
    this.runtimes = options.runtimes;
    this.plugins = options.plugins;
    this.store = options.store;
  }

  /**
   * Load persisted workspaces from DB on daemon startup.
   * All previously-running agents are marked sleeping (processes are gone).
   */
  async loadFromStore(): Promise<void> {
    if (!this.store) return;
    await this.store.markAllAsSleeping();
    const rows = await this.store.listAll();
    for (const row of rows) {
      const sourceRepo: SourceRepo =
        row.source_repo_type === 'url'
          ? { type: 'url', url: row.source_repo_value }
          : { type: 'path', path: row.source_repo_value };
      this.agents.set(row.agent_id, {
        agentId: row.agent_id,
        status: 'sleeping',
        workspacePath: row.workspace_path,
        branch: row.branch,
        runtimeKey: row.runtime_key,
        pluginKey: row.plugin_key,
        sourceRepo,
        mainRepoRoot: row.main_repo_root ?? undefined,
        prompt: row.prompt,
        ...(row.model != null && row.model !== '' ? { model: row.model } : {}),
        sessionId: row.session_id ?? undefined,
        createdAt: row.created_at,
      });
    }
  }

  async startAgent(
    agentId: AgentId,
    sourceRepo: SourceRepo,
    runtimeKey: string,
    pluginKey: string,
    prompt: string,
    options?: { branchName?: string; model?: string }
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
      await this.workspaceManager.createWorkspace(agentId, sourceRepo, runtimeType, options);

    const modelNorm =
      options?.model != null && options.model.trim() !== '' ? options.model.trim() : undefined;

    const record: AgentRecord = {
      agentId,
      status: 'running',
      workspacePath,
      branch,
      runtimeKey,
      pluginKey,
      sourceRepo,
      mainRepoRoot,
      prompt,
      ...(modelNorm != null ? { model: modelNorm } : {}),
      createdAt: new Date().toISOString(),
    };
    this.agents.set(agentId, record);

    await this.store?.insert({
      agentId,
      status: 'running',
      workspacePath,
      branch,
      sourceRepo,
      mainRepoRoot,
      runtimeKey,
      pluginKey,
      prompt,
      model: modelNorm ?? null,
    });

    const plugin = pluginFactory(modelNorm != null ? { model: modelNorm } : undefined);
    const store = this.store;
    await runtime.start(agentId, workspacePath, plugin, prompt, {
      onSessionCreated: (sessionId) => {
        record.sessionId = sessionId;
        store?.updateSessionId(agentId, sessionId).catch(() => {});
      },
    });

    const repoPath = sourceRepo.type === 'path' ? sourceRepo.path : sourceRepo.url;
    return { path: workspacePath, branch, mainRepoRoot, repoPath };
  }

  /** Pause an agent: stop its process but keep the worktree. */
  async pauseAgent(agentId: AgentId): Promise<void> {
    const record = this.agents.get(agentId);
    if (!record) throw new Error(`Agent not found: ${agentId}`);
    if (record.status === 'sleeping') return;

    const runtime = this.runtimes[record.runtimeKey];
    if (runtime) await runtime.stop(agentId);

    record.status = 'sleeping';
    await this.store?.updateStatus(agentId, 'sleeping');
  }

  /** Resume a sleeping agent: restart its process on the existing worktree. */
  async resumeAgent(agentId: AgentId, prompt?: string): Promise<void> {
    const record = this.agents.get(agentId);
    if (!record) throw new Error(`Agent not found: ${agentId}`);
    if (record.status === 'running') throw new Error(`Agent is already running: ${agentId}`);

    const runtime = this.runtimes[record.runtimeKey];
    const pluginFactory = this.plugins[record.pluginKey];
    if (!runtime || !pluginFactory) {
      throw new Error(`Unknown runtime "${record.runtimeKey}" or plugin "${record.pluginKey}"`);
    }

    const effectivePrompt = prompt ?? '';
    const plugin = pluginFactory(record.model != null ? { model: record.model } : undefined);
    const store = this.store;
    await runtime.start(agentId, record.workspacePath, plugin, effectivePrompt, {
      resumeSessionId: record.sessionId,
      onSessionCreated: (sessionId) => {
        record.sessionId = sessionId;
        store?.updateSessionId(agentId, sessionId).catch(() => {});
      },
    });

    record.status = 'running';
    if (prompt) record.prompt = prompt;
    await this.store?.updateStatus(agentId, 'running');
  }

  /** Delete an agent: stop process (if running), remove worktree, remove from DB. */
  async deleteAgent(agentId: AgentId): Promise<void> {
    const record = this.agents.get(agentId);
    if (!record) return;

    if (record.status === 'running') {
      const runtime = this.runtimes[record.runtimeKey];
      if (runtime) await runtime.stop(agentId);
    }

    await this.workspaceManager.removeWorkspace(agentId);
    this.agents.delete(agentId);
    await this.store?.delete(agentId);
  }

  /** Pause all running agents (used during graceful shutdown). */
  async pauseAll(): Promise<void> {
    const running = Array.from(this.agents.values()).filter((r) => r.status === 'running');
    await Promise.allSettled(running.map((r) => this.pauseAgent(r.agentId)));
  }

  getAgentStatus(agentId: AgentId): AgentStatus | undefined {
    return this.agents.get(agentId)?.status;
  }

  getAgentRecord(agentId: AgentId): AgentRecord | undefined {
    const record = this.agents.get(agentId);
    if (!record) return undefined;
    return this.enrichWithAgentState(record);
  }

  listAgents(): AgentRecord[] {
    return Array.from(this.agents.values()).map((r) => this.enrichWithAgentState(r));
  }

  private enrichWithAgentState(record: AgentRecord): AgentRecord {
    if (record.status !== 'running') return record;
    const runtime = this.runtimes[record.runtimeKey];
    const state = runtime?.getAgentState?.(record.agentId);
    if (state?.agentState == null) return record;
    return { ...record, agentState: state.agentState };
  }

  streamLogs(agentId: AgentId): AsyncIterable<StreamEnvelope> {
    const record = this.agents.get(agentId);
    if (!record || record.status !== 'running') {
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
    if (!record) throw new Error(`Agent not found: ${agentId}`);
    if (record.status !== 'running') throw new Error(`Agent is not running: ${agentId}`);
    const runtime = this.runtimes[record.runtimeKey];
    if (!runtime) throw new Error(`Runtime not found: ${record.runtimeKey}`);
    await runtime.sendInput(agentId, input);
  }

  async cancelAgent(agentId: AgentId): Promise<void> {
    const record = this.agents.get(agentId);
    if (!record) return;
    const runtime = this.runtimes[record.runtimeKey];
    await runtime?.cancel?.(agentId);
  }
}

export function getOrchestratorVersion(): string {
  return '0.1.0';
}
