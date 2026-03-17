import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { AgentContext, AgentId, StreamEnvelope } from './types.js';
import type { AgentPlugin } from './types.js';
import { Orchestrator } from './orchestrator.js';
import { WorkspaceManager } from './workspaceManager.js';
import { createLocalRuntime } from './plugins/runtime/local.js';

/** Mock agent: yields deterministic output, no external process. */
function createMockAgent(): AgentPlugin {
  return {
    async run(prompt: string, context: AgentContext): Promise<string> {
      const parts: string[] = [];
      for await (const env of this.stream(prompt, context)) {
        if (env.payload) parts.push(env.payload);
      }
      return parts.join('');
    },
    async *stream(prompt: string, context: AgentContext): AsyncIterable<StreamEnvelope> {
      void context;
      yield { type: 'log', payload: '[mock] started\n' };
      yield { type: 'agent', payload: `Mock output for: ${prompt}\n` };
      yield { type: 'log', payload: '[mock] done\n' };
    },
    async handleInput(agentId: AgentId, input: string): Promise<void> {
      void agentId;
      void input;
    },
  };
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
      plugins: { mock: () => createMockAgent() },
    });
  });

  afterEach(async () => {
    for (const a of orchestrator.listAgents()) {
      await orchestrator.stopAgent(a.agentId);
    }
    await fs.rm(tmpRepo, { recursive: true, force: true });
  });

  it('startAgent creates workspace and runs agent; stream yields output', async () => {
    const agentId = 'int-test-1';
    const result = await orchestrator.startAgent(
      agentId,
      { type: 'path', path: tmpRepo },
      'local',
      'mock',
      'list files in this repo'
    );

    expect(result.path).toContain(agentId);
    expect(result.branch).toMatch(/^clove\//);

    const chunks: string[] = [];
    for await (const envelope of orchestrator.streamLogs(agentId)) {
      chunks.push(envelope.payload);
    }
    const output = chunks.join('');
    expect(output).toContain('Mock output for:');
    expect(output.length).toBeGreaterThan(0);

    const list = orchestrator.listAgents();
    expect(list.some((a) => a.agentId === agentId)).toBe(true);
  });

  it('sendInput and stopAgent work', async () => {
    const agentId = 'int-test-2';
    await orchestrator.startAgent(
      agentId,
      { type: 'path', path: tmpRepo },
      'local',
      'mock',
      'say hello'
    );

    await orchestrator.sendInput(agentId, 'user input here');
    await orchestrator.stopAgent(agentId);

    const list = orchestrator.listAgents();
    expect(list.some((a) => a.agentId === agentId)).toBe(false);
  });
});
