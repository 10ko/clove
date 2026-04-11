import type { CliRuntime } from '../types.js';
import type { CommandHelp } from '../command-help-types.js';
import { runDashboard } from '../dashboard.js';

export const commandHelp: CommandHelp = {
  names: ['dashboard'],
  summary: 'Open dashboard in browser',
  shellLine: 'dashboard                               Open dashboard in browser',
  examples: ['  clove dashboard'],
};

export async function runDashboardCommand(_rest: string[], ctx: CliRuntime): Promise<boolean> {
  await runDashboard(ctx.daemonBaseUrl, {
    exitOnClose: ctx.singleShot,
    ...(ctx.dashboardChildRef && { dashboardChildRef: ctx.dashboardChildRef }),
  });
  return false;
}
