import type { CliRuntime } from '../types.js';
import type { CommandHelp } from '../command-help-types.js';

export const commandHelp: CommandHelp = {
  names: ['exit', 'quit'],
  summary: 'Exit the shell (shell only)',
  shellLine: 'exit, quit                              Exit shell',
};

export async function runExit(rest: string[], ctx: CliRuntime): Promise<boolean> {
  void rest;
  void ctx;
  return true;
}
