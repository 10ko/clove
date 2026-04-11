import type { CliRuntime } from '../types.js';
import type { CommandHelp } from '../command-help-types.js';

export const commandHelp: CommandHelp = {
  names: ['stop', 'pause'],
  summary: 'Pause a running agent (keep workspace)',
  shellLine: 'stop <agent-id>                         Pause agent (keep workspace)',
  examples: ['  clove stop <agent-id>                     # pause agent, keep workspace'],
};

export async function runStop(rest: string[], ctx: CliRuntime): Promise<boolean> {
  const agentId = rest[0];
  if (!agentId) {
    console.error('stop (or pause) requires <agent-id>');
    return false;
  }
  await ctx.api.pauseAgent(agentId);
  console.log(`Paused agent ${agentId} (workspace kept)`);
  return false;
}
