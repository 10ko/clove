import type { CommandHelp } from './command-help-types.js';

/** Daemon is routed in `main.ts`, not `router.ts`, but its help lives here for one place to edit. */
export const daemonCommandHelp: CommandHelp = {
  names: ['daemon'],
  summary: 'Ensure daemon is running; print its URL',
  additionalLines: [
    '  daemon --foreground   Run daemon in foreground (for dev)',
    '  daemon stop           Stop the background daemon',
    '  daemon status         Show daemon PID, port, and health',
  ],
  examples: ['  clove daemon --foreground                 # run daemon in foreground (for dev)'],
};
