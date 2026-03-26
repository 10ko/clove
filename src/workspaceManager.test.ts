import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WorkspaceManager } from './workspaceManager.js';

describe('WorkspaceManager', () => {
  let tmpDir: string;
  let manager: WorkspaceManager;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `clove-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@clove.dev"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Clove Test"', { cwd: tmpDir, stdio: 'pipe' });
    await fs.writeFile(path.join(tmpDir, 'README'), 'test');
    execSync('git add README && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    manager = new WorkspaceManager();
  });

  afterEach(async () => {
    for (const agentId of manager.listAgentIds()) {
      await manager.removeWorkspace(agentId);
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('createWorkspace (local)', () => {
    it('creates a worktree on a new branch and returns path and branch', async () => {
      const result = await manager.createWorkspace(
        'agent-1',
        { type: 'path', path: tmpDir },
        'local'
      );

      expect(result.path).toContain('agent-1');
      expect(result.branch).toBe('clove/agent-1');
      const stat = await fs.stat(result.path);
      expect(stat.isDirectory()).toBe(true);
      const branchOut = execSync('git branch --show-current', {
        cwd: result.path,
        encoding: 'utf-8',
      }).trim();
      expect(branchOut).toBe('clove/agent-1');
    });

    it('stores workspace so getWorkspacePath and listAgentIds work', async () => {
      const result = await manager.createWorkspace(
        'my-agent',
        { type: 'path', path: tmpDir },
        'local'
      );

      expect(manager.getWorkspacePath('my-agent')).toBe(result.path);
      expect(manager.listAgentIds()).toContain('my-agent');
    });

    it('sanitizes agent id for branch name', async () => {
      const result = await manager.createWorkspace(
        'agent/with/slashes',
        { type: 'path', path: tmpDir },
        'local'
      );
      expect(result.branch).toMatch(/^clove\/agent-with-slashes$/);
    });

    it('uses custom branchName as full branch when provided', async () => {
      const result = await manager.createWorkspace(
        'my-agent',
        { type: 'path', path: tmpDir },
        'local',
        { branchName: 'feature/add-tests' }
      );
      expect(result.path).toContain('my-agent');
      expect(result.branch).toBe('feature/add-tests');
    });

    it('throws if source path is not a directory', async () => {
      await expect(
        manager.createWorkspace(
          'x',
          { type: 'path', path: path.join(tmpDir, 'nonexistent') },
          'local'
        )
      ).rejects.toThrow(/not a directory/);
    });

    it('throws for remote runtime with path source', async () => {
      await expect(
        manager.createWorkspace('x', { type: 'path', path: tmpDir }, 'remote')
      ).rejects.toThrow(/sourceRepo.type === "url"/);
    });

    it('throws for local runtime with URL source', async () => {
      await expect(
        manager.createWorkspace(
          'x',
          { type: 'url', url: 'https://github.com/foo/bar' },
          'local'
        )
      ).rejects.toThrow(/sourceRepo.type === "path"/);
    });
  });

  describe('writeArtifact', () => {
    it('writes artifact under workspace .clove/artifacts/<kind>/', async () => {
      const { path: workspacePath } = await manager.createWorkspace(
        'a1',
        { type: 'path', path: tmpDir },
        'local'
      );

      await manager.writeArtifact('a1', 'logs', 'run.log', 'hello');
      await manager.writeArtifact('a1', 'prompts', 'p1.txt', 'fix the bug');

      const logPath = path.join(workspacePath, '.clove', 'artifacts', 'logs', 'run.log');
      const promptPath = path.join(workspacePath, '.clove', 'artifacts', 'prompts', 'p1.txt');
      expect(await fs.readFile(logPath, 'utf-8')).toBe('hello');
      expect(await fs.readFile(promptPath, 'utf-8')).toBe('fix the bug');
    });

    it('throws if agent has no workspace', async () => {
      await expect(
        manager.writeArtifact('nonexistent', 'logs', 'x', 'y')
      ).rejects.toThrow(/No workspace/);
    });
  });

  describe('removeWorkspace', () => {
    it('removes worktree and branch and clears from map', async () => {
      const result = await manager.createWorkspace(
        'to-remove',
        { type: 'path', path: tmpDir },
        'local'
      );

      await manager.removeWorkspace('to-remove');

      expect(manager.getWorkspacePath('to-remove')).toBeUndefined();
      expect(manager.listAgentIds()).not.toContain('to-remove');
      await expect(fs.stat(result.path)).rejects.toThrow();
    });

    it('is idempotent when agent unknown', async () => {
      await expect(manager.removeWorkspace('unknown')).resolves.toBeUndefined();
    });
  });
});
