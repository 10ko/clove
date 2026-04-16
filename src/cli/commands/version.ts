import type { CliRuntime } from '../types.js';
import type { CommandHelp } from '../command-help-types.js';
import { CLOVE_VERSION } from '../../clove-version.js';

export const commandHelp: CommandHelp = {
  names: ['version'],
  summary: 'Print clove version',
  shellLine: 'version                                 Print clove version',
};

export async function runVersion(_rest: string[], _ctx: CliRuntime): Promise<boolean> {
  void _rest;
  void _ctx;
  console.log(CLOVE_VERSION);
  return false;
}
