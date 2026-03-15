/**
 * Workspace / artifact manager: per-agent workspaces (worktree for local, clone+branch for remote),
 * plus artifact storage under the workspace.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  AgentId,
  RuntimeType,
  SourceRepo,
  WorkspaceResult,
} from './types.js';

const ARTIFACT_DIR = '.clove/artifacts';
const ARTIFACT_KINDS = ['logs', 'prompts', 'outputs', 'patches'] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

const BRANCH_PREFIX = 'clove/';

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Sanitize agent id for use in a git branch name. */
function branchNameFor(agentId: AgentId): string {
  const safe = agentId.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  return `${BRANCH_PREFIX}${safe || 'agent'}`;
}

export interface WorkspaceManagerOptions {
  /** Base directory for local worktrees. Default: <sourceRepo>/.clove/worktrees */
  worktreeBasePath?: string;
  /** Base directory for remote clones. Default: os.tmpdir()/clove-clones */
  cloneBasePath?: string;
}

interface WorkspaceEntry {
  path: string;
  branch: string;
  runtimeType: RuntimeType;
  /** Main repo root (for local worktrees), used for branch cleanup. */
  mainRepoRoot?: string;
}

export class WorkspaceManager {
  private readonly workspaces = new Map<AgentId, WorkspaceEntry>();
  private readonly options: WorkspaceManagerOptions;

  constructor(options: WorkspaceManagerOptions = {}) {
    this.options = options;
  }

  /**
   * Create an isolated workspace for an agent.
   * - Local: git worktree from source repo on a new branch.
   * - Remote: stub for Phase 5 (clone + branch); throws for now.
   */
  async createWorkspace(
    agentId: AgentId,
    sourceRepo: SourceRepo,
    runtimeType: RuntimeType
  ): Promise<WorkspaceResult> {
    if (runtimeType === 'remote') {
      return this.createWorkspaceRemote(agentId, sourceRepo);
    }
    if (sourceRepo.type !== 'path') {
      throw new Error('Local runtime requires sourceRepo.type === "path"');
    }
    return this.createWorkspaceLocal(agentId, sourceRepo.path);
  }

  private async createWorkspaceLocal(
    agentId: AgentId,
    sourceRepoPath: string
  ): Promise<WorkspaceResult> {
    const repoRoot = path.resolve(sourceRepoPath);
    await this.ensureGitRepo(repoRoot);

    const branch = branchNameFor(agentId);
    const base =
      this.options.worktreeBasePath ?? path.join(repoRoot, '.clove', 'worktrees');
    const worktreePath = path.join(base, agentId);

    await fs.mkdir(path.dirname(worktreePath), { recursive: true });

    execSync(`git worktree add "${worktreePath}" -b "${branch}"`, {
      cwd: repoRoot,
      stdio: 'pipe',
    });

    this.workspaces.set(agentId, {
      path: worktreePath,
      branch,
      runtimeType: 'local',
      mainRepoRoot: repoRoot,
    });

    return { path: worktreePath, branch, mainRepoRoot: repoRoot };
  }

  private async createWorkspaceRemote(
    agentId: AgentId,
    sourceRepo: SourceRepo
  ): Promise<WorkspaceResult> {
    if (sourceRepo.type !== 'url') {
      throw new Error('Remote runtime requires sourceRepo.type === "url"');
    }
    const base =
      this.options.cloneBasePath ?? path.join(os.tmpdir(), 'clove-clones');
    const clonePath = path.join(base, agentId);
    await fs.mkdir(path.dirname(clonePath), { recursive: true });
    if (await pathExists(clonePath)) {
      await fs.rm(clonePath, { recursive: true, force: true });
    }
    execSync(`git clone "${sourceRepo.url}" "${clonePath}"`, {
      stdio: 'pipe',
    });
    const branch = branchNameFor(agentId);
    execSync(`git checkout -b "${branch}"`, {
      cwd: clonePath,
      stdio: 'pipe',
    });
    this.workspaces.set(agentId, {
      path: clonePath,
      branch,
      runtimeType: 'remote',
    });
    return { path: clonePath, branch };
  }

  private async ensureGitRepo(repoPath: string): Promise<void> {
    const stat = await fs.stat(repoPath).catch(() => null);
    if (!stat?.isDirectory()) {
      throw new Error(`Source repo path is not a directory: ${repoPath}`);
    }
    const gitDir = path.join(repoPath, '.git');
    const gitStat = await fs.stat(gitDir).catch(() => null);
    if (!gitStat?.isDirectory()) {
      throw new Error(`Not a git repository: ${repoPath}`);
    }
    try {
      execSync('git rev-parse HEAD', { cwd: repoPath, stdio: 'pipe' });
    } catch {
      throw new Error(
        `Repository has no commits yet. Create an initial commit before using Clove. Path: ${repoPath}`
      );
    }
  }

  /** Get the workspace path for an agent, if it exists. */
  getWorkspacePath(agentId: AgentId): string | undefined {
    return this.workspaces.get(agentId)?.path;
  }

  /** Write an artifact file under the agent's workspace. */
  async writeArtifact(
    agentId: AgentId,
    kind: ArtifactKind,
    name: string,
    data: string | Buffer
  ): Promise<void> {
    const workspacePath = this.workspaces.get(agentId)?.path;
    if (!workspacePath) {
      throw new Error(`No workspace for agent: ${agentId}`);
    }
    if (!ARTIFACT_KINDS.includes(kind)) {
      throw new Error(`Invalid artifact kind: ${kind}`);
    }
    const dir = path.join(workspacePath, ARTIFACT_DIR, kind);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, data, typeof data === 'string' ? 'utf-8' : undefined);
  }

  /**
   * Remove workspace and release resources.
   * Local: removes git worktree and deletes the branch.
   */
  async removeWorkspace(agentId: AgentId): Promise<void> {
    const entry = this.workspaces.get(agentId);
    if (!entry) {
      return;
    }
    this.workspaces.delete(agentId);

    if (entry.runtimeType === 'local' && entry.mainRepoRoot) {
      try {
        execSync(`git worktree remove --force "${entry.path}"`, {
          cwd: entry.mainRepoRoot,
          stdio: 'pipe',
        });
      } catch {
        // Worktree may already be removed or moved
      }
      try {
        execSync(`git branch -D "${entry.branch}"`, {
          cwd: entry.mainRepoRoot,
          stdio: 'pipe',
        });
      } catch {
        // Branch may already be deleted
      }
    }
    if (entry.runtimeType === 'remote') {
      try {
        await fs.rm(entry.path, { recursive: true, force: true });
      } catch {
        // Clone may already be removed
      }
    }
  }

  /** List all known workspace agent ids. */
  listAgentIds(): AgentId[] {
    return Array.from(this.workspaces.keys());
  }
}

/**
 * Remove a local worktree by path and main repo root (for cross-process stop when
 * the agent was started in another process and we only have persisted state).
 */
export function removeWorktreeByPath(
  workspacePath: string,
  mainRepoRoot: string,
  branch: string
): void {
  try {
    execSync(`git worktree remove --force "${workspacePath}"`, {
      cwd: mainRepoRoot,
      stdio: 'pipe',
    });
  } catch {
    // Worktree may already be removed
  }
  try {
    execSync(`git branch -D "${branch}"`, {
      cwd: mainRepoRoot,
      stdio: 'pipe',
    });
  } catch {
    // Branch may already be deleted
  }
}
