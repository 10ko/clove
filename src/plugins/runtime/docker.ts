/**
 * Docker runtime: run the agent in a container with the workspace mounted.
 * Streams container stdout/stderr; sendInput is best-effort (writes to container stdin if supported).
 */

import { spawn } from 'node:child_process';
import type { AgentId, AgentPlugin, AgentRuntime, StreamEnvelope } from '../../types.js';

export interface DockerRuntimeOptions {
  /** Docker image to run. Default: node:20-bookworm-slim */
  image?: string;
  /** Working directory inside the container. Default: /workspace */
  workspaceMountPath?: string;
}

/** Queue that buffers stream chunks and supports replay (same as local runtime). */
class StreamQueue {
  private readonly replay: StreamEnvelope[] = [];
  private readonly waiters: Array<() => void> = [];
  private done = false;

  push(envelope: StreamEnvelope): void {
    this.replay.push(envelope);
    for (const w of this.waiters) w();
    this.waiters.length = 0;
  }

  close(): void {
    this.done = true;
    for (const w of this.waiters) w();
    this.waiters.length = 0;
  }

  private waitForMore(): Promise<void> {
    return new Promise((resolve) => {
      this.waiters.push(resolve);
    });
  }

  async *drain(): AsyncIterable<StreamEnvelope> {
    let i = 0;
    while (true) {
      if (i < this.replay.length) {
        yield this.replay[i++];
      } else if (this.done) {
        break;
      } else {
        await this.waitForMore();
      }
    }
  }
}

interface DockerAgentEntry {
  containerName: string;
  queue: StreamQueue;
  processExitPromise: Promise<number | null>;
}

export function createDockerRuntime(
  options: DockerRuntimeOptions = {}
): AgentRuntime {
  const image = options.image ?? 'node:20-bookworm-slim';
  const workspaceMountPath = options.workspaceMountPath ?? '/workspace';
  const entries = new Map<AgentId, DockerAgentEntry>();

  return {
    async start(
      agentId: AgentId,
      workspacePath: string,
      agent: AgentPlugin,
      prompt: string
    ): Promise<void> {
      if (entries.has(agentId)) {
        throw new Error(`Agent already running: ${agentId}`);
      }
      const containerName = `clove-${agentId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      const queue = new StreamQueue();

      const child = spawn(
        'docker',
        [
          'run',
          '--rm',
          '--name',
          containerName,
          '-v',
          `${workspacePath}:${workspaceMountPath}`,
          '-w',
          workspaceMountPath,
          '-e',
          `PROMPT=${prompt.replace(/"/g, '\\"')}`,
          image,
          'sh',
          '-c',
          `echo "[docker] workspace=${workspaceMountPath} agentId=${agentId}"; echo "Echo: $PROMPT"; echo "Done."`,
        ],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      child.stdout?.on('data', (data: Buffer) => {
        queue.push({ type: 'agent', payload: data.toString() });
      });
      child.stderr?.on('data', (data: Buffer) => {
        queue.push({ type: 'log', payload: data.toString() });
      });

      const processExitPromise = new Promise<number | null>((resolve) => {
        child.on('exit', (code) => {
          queue.close();
          resolve(code);
        });
      });

      child.on('error', (err) => {
        queue.push({ type: 'log', payload: `[docker error] ${err.message}\n` });
        queue.close();
      });

      entries.set(agentId, {
        containerName,
        queue,
        processExitPromise,
      });
    },

    async stop(agentId: AgentId): Promise<void> {
      const entry = entries.get(agentId);
      if (!entry) return;
      entries.delete(agentId);
      entry.queue.close();
      try {
        const kill = spawn('docker', ['kill', entry.containerName], {
          stdio: 'pipe',
        });
        await new Promise<void>((resolve, reject) => {
          kill.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`docker kill exited ${code}`))));
          kill.on('error', reject);
        });
      } catch {
        // Container may already be gone
      }
      await entry.processExitPromise;
    },

    async *streamLogs(agentId: AgentId): AsyncIterable<StreamEnvelope> {
      const entry = entries.get(agentId);
      if (!entry) return;
      yield* entry.queue.drain();
    },

    async sendInput(agentId: AgentId, input: string): Promise<void> {
      void agentId;
      void input; // Docker runtime: stdin not wired for long-running attach; no-op for now
    },
  };
}
