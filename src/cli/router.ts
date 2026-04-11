import type { CliRuntime } from './types.js';
import { buildFullHelp } from './help-generate.js';
import { runList } from './commands/list.js';
import { runStart } from './commands/start.js';
import { runHelp } from './commands/help.js';
import { runDashboardCommand } from './commands/dashboard-cmd.js';
import { runStop } from './commands/stop.js';
import { runResume } from './commands/resume.js';
import { runDelete } from './commands/delete.js';
import { runSendInput } from './commands/send-input.js';
import { runStream } from './commands/stream.js';
import { runExit } from './commands/exit.js';

/** Commands valid as `clove <cmd>` one-shots (excluding global flags handled in main). */
export const ONE_SHOT_COMMANDS = [
  'start',
  'stop',
  'pause',
  'resume',
  'delete',
  'stream',
  'send-input',
  'list',
  'help',
] as const;

type CommandHandler = (rest: string[], ctx: CliRuntime) => Promise<boolean>;

const handlers: Record<string, CommandHandler> = {
  list: runList,
  start: runStart,
  help: runHelp,
  '--help': runHelp,
  '-h': runHelp,
  dashboard: runDashboardCommand,
  stop: runStop,
  pause: runStop,
  resume: runResume,
  delete: runDelete,
  'send-input': runSendInput,
  stream: runStream,
  exit: runExit,
  quit: runExit,
};

/**
 * Run a shell or one-shot command.
 * @returns true when the interactive shell should exit
 */
export async function runCommand(command: string, rest: string[], ctx: CliRuntime): Promise<boolean> {
  const cmd = command.toLowerCase();
  const fn = handlers[cmd];
  if (!fn) {
    console.error(`Unknown command "${command}". Type 'help' for usage.`);
    return false;
  }
  return fn(rest, ctx);
}

export function printFullHelp(): void {
  console.log(buildFullHelp());
}
