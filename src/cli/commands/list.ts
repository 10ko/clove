import type { CliRuntime } from '../types.js';
import type { CommandHelp } from '../command-help-types.js';

export const commandHelp: CommandHelp = {
  names: ['list'],
  summary: 'List agents and status',
  shellLine: 'list                                    List all agents (running + sleeping)',
  examples: ['  clove list'],
};

export async function runList(_rest: string[], ctx: CliRuntime): Promise<boolean> {
  const agents = await ctx.api.listAgents();
  if (agents.length === 0) {
    console.log('No agents.');
    return false;
  }
  for (const a of agents) {
    const state = a.agentState ? ` (${a.agentState})` : '';
    console.log(`${a.agentId}  ${a.status}${state}  ${a.workspacePath}`);
  }
  return false;
}
