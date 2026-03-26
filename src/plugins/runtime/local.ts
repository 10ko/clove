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
  streamIterator: AsyncIterator<StreamEnvelope>;
  abortController: AbortController;
  agentStateRef?: AgentStateRef;
}

export function createLocalRuntime(): AgentRuntime {
  const entries = new Map<AgentId, LocalAgentEntry>();

  return {
    async start(
      agentId: AgentId,
      workspacePath: string,
      agent: AgentPlugin,
      prompt: string,
      options?: { resumeSessionId?: string; onSessionCreated?: (sessionId: string) => void }
    ): Promise<void> {
      if (entries.has(agentId)) {
        throw new Error(`Agent already running: ${agentId}`);
      }
      const queue = new StreamQueue();
      const agentStateRef: AgentStateRef = { current: 'waiting' };
      const abortController = new AbortController();
      const context: import('../../types.js').AgentContext = {
        workspacePath,
        agentId,
        agentStateRef,
        abortSignal: abortController.signal,
        resumeSessionId: options?.resumeSessionId,
        onSessionCreated: options?.onSessionCreated,
      };
      const stream = agent.stream(prompt, context);
      const streamIterator = stream[Symbol.asyncIterator]();
      const taskPromise = (async () => {
        try {
          for (;;) {
            const result = await streamIterator.next();
            if (result.done) break;
            if (result.value) queue.push(result.value);
          }
        } finally {
          queue.close();
        }
      })();
      entries.set(agentId, { agent, queue, taskPromise, streamIterator, abortController, agentStateRef });
    },

    async stop(agentId: AgentId): Promise<void> {
      const entry = entries.get(agentId);
      if (!entry) return;
      entries.delete(agentId);
      entry.queue.close();
      entry.abortController.abort();
      entry.streamIterator.return?.();
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

    async cancel(agentId: AgentId): Promise<void> {
      const entry = entries.get(agentId);
      if (!entry) return;
      await entry.agent.cancel?.(agentId);
    },

    getAgentState(agentId: AgentId): { agentState?: AgentState } | undefined {
      const entry = entries.get(agentId);
      const state = entry?.agentStateRef?.current;
      return state != null ? { agentState: state } : undefined;
    },
  };
}
