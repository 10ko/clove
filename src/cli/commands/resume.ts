import type { CliRuntime } from '../types.js';
import type { CommandHelp } from '../command-help-types.js';
import { getArg } from '../utils.js';

export const commandHelp: CommandHelp = {
  names: ['resume'],
  summary: 'Resume a sleeping agent',
  shellLine: 'resume <agent-id> [--prompt "<text>"]   Resume sleeping agent',
  examples: ['  clove resume <agent-id>                   # resume sleeping agent'],
};

export async function runResume(rest: string[], ctx: CliRuntime): Promise<boolean> {
  const agentId = rest[0];
  if (!agentId) {
    console.error('resume requires <agent-id>');
    return false;
  }
  const prompt = getArg(rest.slice(1), '--prompt') ?? '';
  await ctx.api.resumeAgent(agentId, prompt || undefined);
  console.log(`Resumed agent ${agentId}`);
  return false;
}
