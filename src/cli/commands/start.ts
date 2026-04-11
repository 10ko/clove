import type { CliRuntime } from '../types.js';
import type { CommandHelp } from '../command-help-types.js';
import { generateMemorableId, getArg, parseSourceRepo } from '../utils.js';

export const commandHelp: CommandHelp = {
  names: ['start'],
  summary: 'Start an agent (repo required; prompt optional)',
  shellLine:
    'start --repo <path> [--agent-id <id>] [--branch <name>] [--prompt "<text>"] [--runtime local] [--agent cursor]',
  examples: ['  clove start --repo . --prompt "Add tests" # one-shot command'],
};

export async function runStart(rest: string[], ctx: CliRuntime): Promise<boolean> {
  const repo = getArg(rest, '--repo');
  const prompt = getArg(rest, '--prompt') ?? '';
  const agentId = getArg(rest, '--agent-id') ?? generateMemorableId();
  const branchName = getArg(rest, '--branch');
  const runtimeKey = getArg(rest, '--runtime') ?? 'local';
  const pluginKey = getArg(rest, '--agent') ?? getArg(rest, '--plugin') ?? 'cursor';
  if (!repo) {
    console.error('start requires --repo <path-or-url>');
    return false;
  }
  const sourceRepo = parseSourceRepo(repo);
  const result = await ctx.api.startAgent({
    agentId,
    sourceRepo,
    runtimeKey,
    pluginKey,
    prompt,
    ...(branchName != null && branchName !== '' && { branchName }),
  });
  console.log(`Started agent ${agentId} (runtime=${runtimeKey}, agent=${pluginKey})`);
  console.log(`  workspace: ${result.path}`);
  console.log(`  branch: ${result.branch}`);
  return false;
}
