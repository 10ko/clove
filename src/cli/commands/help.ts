import type { CliRuntime } from '../types.js';
import { buildFullHelp, buildShellHelp } from '../help-generate.js';

export async function runHelp(_rest: string[], ctx: CliRuntime): Promise<boolean> {
  console.log(ctx.singleShot ? buildFullHelp() : buildShellHelp());
  return false;
}
