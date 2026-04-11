import * as readline from 'node:readline';
import type { CliRuntime } from '../types.js';
import type { CommandHelp } from '../command-help-types.js';

export const commandHelp: CommandHelp = {
  names: ['delete'],
  summary: 'Delete agent and remove workspace',
  shellLine: 'delete <agent-id>                       Delete agent + workspace',
  examples: ['  clove delete <agent-id>                   # remove workspace + worktree'],
};

export async function runDelete(rest: string[], ctx: CliRuntime): Promise<boolean> {
  const agentId = rest[0];
  if (!agentId) {
    console.error('delete requires <agent-id>');
    return false;
  }
  const skipConfirm = rest.includes('--yes') || rest.includes('-y');
  if (!skipConfirm) {
    const answer = await new Promise<string>((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(
        `This will permanently delete the worktree for ${agentId}. Continue? [y/N] `,
        (ans) => {
          rl.close();
          resolve(ans.trim().toLowerCase());
        }
      );
    });
    if (answer !== 'y' && answer !== 'yes') {
      console.log('Cancelled.');
      return false;
    }
  }
  await ctx.api.deleteAgent(agentId);
  console.log(`Deleted agent ${agentId} (workspace removed)`);
  return false;
}
