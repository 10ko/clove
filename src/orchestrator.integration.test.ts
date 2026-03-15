import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Orchestrator } from './orchestrator.js';
import { WorkspaceManager } from './workspaceManager.js';
import { createLocalRuntime } from './plugins/runtime/local.js';
import { createCursorAgent } from './plugins/agent/cursor.js';

function isCursorInstalled(): boolean {
  const r = spawnSync('agent', ['--version'], { stdio: 'pipe', timeout: 5000 });
  return r.status === 0;
}

describe('Orchestrator (integration)', () => {
  let tmpRepo: string;
  let orchestrator: Orchestrator;

  beforeEach(async () => {
    tmpRepo = path.join(
      os.tmpdir(),
      `clove-orch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    await fs.mkdir(tmpRepo, { recursive: true });
    execSync('git init', { cwd: tmpRepo, stdio: 'pipe' });
    execSync('git config user.email "test@clove.dev"', { cwd: tmpRepo, stdio: 'pipe' });
    execSync('git config user.name "Clove Test"', { cwd: tmpRepo, stdio: 'pipe' });
    await fs.writeFile(path.join(tmpRepo, 'README'), 'test');
    execSync('git add README && git commit -m "init"', { cwd: tmpRepo, stdio: 'pipe' });

    orchestrator = new Orchestrator({
      workspaceManager: new WorkspaceManager(),
      runtimes: { local: createLocalRuntime() },
      plugins: { cursor: () => createCursorAgent() },
    });
  });

  afterEach(async () => {
    for (const a of orchestrator.listAgents()) {
      await orchestrator.stopAgent(a.agentId);
    }
    await fs.rm(tmpRepo, { recursive: true, force: true });
  });

  it.skipIf(!isCursorInstalled())(
    'startAgent creates workspace and runs cursor agent; stream yields output',
    async () => {
      const agentId = 'int-test-1';
      const result = await orchestrator.startAgent(
        agentId,
        { type: 'path', path: tmpRepo },
        'local',
        'cursor',
        'list files in this repo'
      );

      expect(result.path).toContain(agentId);
      expect(result.branch).toMatch(/^clove\//);

      const chunks: string[] = [];
      const iterator = orchestrator.streamLogs(agentId);
      const timeout = Date.now() + 15000;
      for await (const chunk of iterator) {
        chunks.push(chunk);
        if (chunks.join('').length > 50 || Date.now() > timeout) break;
      }
      const output = chunks.join('');
      expect(output.length).toBeGreaterThan(0);

      const list = orchestrator.listAgents();
      expect(list.some((a) => a.agentId === agentId)).toBe(true);
    }
  );

  it.skipIf(!isCursorInstalled())('sendInput and stopAgent work', async () => {
    const agentId = 'int-test-2';
    await orchestrator.startAgent(
      agentId,
      { type: 'path', path: tmpRepo },
      'local',
      'cursor',
      'say hello'
    );

    await orchestrator.sendInput(agentId, 'user input here');
    await orchestrator.stopAgent(agentId);

    const list = orchestrator.listAgents();
    expect(list.some((a) => a.agentId === agentId)).toBe(false);
  });
});
