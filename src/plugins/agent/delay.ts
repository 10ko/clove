/**
 * Delay agent plugin: like echo but with a short delay between chunks.
 * Useful for testing streaming and timeout behavior.
 */

import type { AgentContext, AgentPlugin } from '../../types.js';

const DEFAULT_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDelayAgent(delayMs: number = DEFAULT_MS): AgentPlugin {
  return {
    async run(prompt: string, context: AgentContext): Promise<string> {
      const parts: string[] = [];
      for await (const chunk of this.stream(prompt, context)) {
        parts.push(chunk);
      }
      return parts.join('');
    },

    async *stream(prompt: string, context: AgentContext): AsyncIterable<string> {
      yield `[delay] workspace=${context.workspacePath} agentId=${context.agentId}\n`;
      await sleep(delayMs);
      yield `Echo (delayed): ${prompt}\n`;
      await sleep(delayMs);
      yield 'Done.\n';
    },

    async handleInput(_agentId: string, input: string): Promise<void | string> {
      void input; // no-op for delay agent
      return undefined;
    },
  };
}
