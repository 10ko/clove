/**
 * Local runtime: runs the agent plugin in the same process, feeds stream to consumers.
 * Supports replay: each streamLogs() call sees all output so far, then any new output.
 */

import type {
  AgentId,
  AgentPlugin,
  AgentRuntime,
  AgentState,
  AgentStateRef,
  StreamEnvelope,
} from '../../types.js';

/** Append-only replay buffer plus live waiters so multiple streamLogs() calls get replay + tail. */
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

  /** Wait until replay has more content or stream is done. */
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

interface LocalAgentEntry {
  agent: AgentPlugin;
  queue: StreamQueue;
  taskPromise: Promise<void>;
  agentStateRef?: AgentStateRef;
}

export function createLocalRuntime(): AgentRuntime {
  const entries = new Map<AgentId, LocalAgentEntry>();

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
      const queue = new StreamQueue();
      const agentStateRef: AgentStateRef = { current: 'waiting' };
      const context = { workspacePath, agentId, agentStateRef };
      const taskPromise = (async () => {
        try {
          for await (const chunk of agent.stream(prompt, context)) {
            queue.push(chunk);
          }
        } finally {
          queue.close();
        }
      })();
      entries.set(agentId, { agent, queue, taskPromise, agentStateRef });
    },

    async stop(agentId: AgentId): Promise<void> {
      const entry = entries.get(agentId);
      if (entry) {
        entries.delete(agentId);
        entry.queue.close();
        await entry.taskPromise;
      }
    },

    async *streamLogs(agentId: AgentId): AsyncIterable<StreamEnvelope> {
      const entry = entries.get(agentId);
      if (!entry) {
        return;
      }
      yield* entry.queue.drain();
    },

    async sendInput(agentId: AgentId, input: string): Promise<void> {
      const entry = entries.get(agentId);
      if (!entry) {
        throw new Error(`Agent not found: ${agentId}`);
      }
      const out = await entry.agent.handleInput(agentId, input);
      if (typeof out === 'string' && out) {
        entry.queue.push({ type: 'agent', payload: out });
      }
    },

    getAgentState(agentId: AgentId): { agentState?: AgentState } | undefined {
      const entry = entries.get(agentId);
      const state = entry?.agentStateRef?.current;
      return state != null ? { agentState: state } : undefined;
    },
  };
}
