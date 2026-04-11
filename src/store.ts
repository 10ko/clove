/**
 * Persistence layer: CRUD for workspace/agent records in SQLite.
 */

import type { Kysely } from 'kysely';
import type { DatabaseSchema, WorkspaceRow } from './db.js';
import type { SourceRepo } from './types.js';

interface InsertWorkspace {
  agentId: string;
  status: 'running' | 'sleeping';
  workspacePath: string;
  branch: string;
  sourceRepo: SourceRepo;
  mainRepoRoot?: string;
  runtimeKey: string;
  pluginKey: string;
  prompt: string;
}

export class WorkspaceStore {
  constructor(private readonly db: Kysely<DatabaseSchema>) {}

  async insert(ws: InsertWorkspace): Promise<void> {
    const now = new Date().toISOString();
    await this.db.insertInto('workspaces').values({
      agent_id: ws.agentId,
      status: ws.status,
      workspace_path: ws.workspacePath,
      branch: ws.branch,
      source_repo_type: ws.sourceRepo.type,
      source_repo_value: ws.sourceRepo.type === 'path' ? ws.sourceRepo.path : ws.sourceRepo.url,
      main_repo_root: ws.mainRepoRoot ?? null,
      runtime_key: ws.runtimeKey,
      plugin_key: ws.pluginKey,
      prompt: ws.prompt,
      session_id: null,
      created_at: now,
      updated_at: now,
    }).execute();
  }

  async updateStatus(agentId: string, status: 'running' | 'sleeping'): Promise<void> {
    await this.db.updateTable('workspaces')
      .set({ status, updated_at: new Date().toISOString() })
      .where('agent_id', '=', agentId)
      .execute();
  }

  async updateSessionId(agentId: string, sessionId: string): Promise<void> {
    await this.db.updateTable('workspaces')
      .set({ session_id: sessionId, updated_at: new Date().toISOString() })
      .where('agent_id', '=', agentId)
      .execute();
  }

  async delete(agentId: string): Promise<void> {
    await this.db.deleteFrom('workspaces')
      .where('agent_id', '=', agentId)
      .execute();
  }

  async get(agentId: string): Promise<WorkspaceRow | undefined> {
    return await this.db.selectFrom('workspaces')
      .selectAll()
      .where('agent_id', '=', agentId)
      .executeTakeFirst();
  }

  async listAll(): Promise<WorkspaceRow[]> {
    return await this.db.selectFrom('workspaces')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();
  }

  async markAllAsSleeping(): Promise<void> {
    await this.db.updateTable('workspaces')
      .set({ status: 'sleeping', updated_at: new Date().toISOString() })
      .where('status', '=', 'running')
      .execute();
  }
}
