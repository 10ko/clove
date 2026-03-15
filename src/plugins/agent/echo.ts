/**
 * Echo agent plugin: stub that yields prompt back as stream and accepts handleInput.
 * No real AI; for testing and as a template for other plugins.
 */

import type { AgentContext, AgentPlugin } from '../../types.js';

export function createEchoAgent(): AgentPlugin {
  let lastInput: string | null = null;

  return {
    async run(prompt: string, context: AgentContext): Promise<string> {
      const parts: string[] = [];
      for await (const chunk of this.stream(prompt, context)) {
        parts.push(chunk);
      }
      return parts.join('');
    },

    async *stream(prompt: string, context: AgentContext): AsyncIterable<string> {
      yield `[echo] workspace=${context.workspacePath} agentId=${context.agentId}\n`;
      yield `Echo: ${prompt}\n`;
      if (lastInput !== null) {
        yield `(last input: ${lastInput})\n`;
        lastInput = null;
      }
      yield 'Done.\n';
    },

    async handleInput(_agentId: string, input: string): Promise<void | string> {
      lastInput = input;
      return `\n(Received input: ${input})\n`;
    },
  };
}
