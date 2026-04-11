import type { CliRuntime } from '../types.js';
import type { CommandHelp } from '../command-help-types.js';

export const commandHelp: CommandHelp = {
  names: ['send-input'],
  summary: 'Send input to a running agent',
  shellLine: 'send-input <agent-id> "<input>"         Send input to agent',
};

export async function runSendInput(rest: string[], ctx: CliRuntime): Promise<boolean> {
  const agentId = rest[0];
  if (!agentId) {
    console.error('send-input requires <agent-id> <input>');
    return false;
  }
  const input = rest.slice(1).join(' ').trim();
  if (!input) {
    console.error('send-input requires <agent-id> <input>');
    return false;
  }
  await ctx.api.sendInput(agentId, input);
  console.log(`Sent input to ${agentId}`);
  return false;
}
