import type { CommandHelp } from './command-help-types.js';

/** Daemon is routed in `main.ts` for CLI; REPL uses `commands/daemon-cmd.ts`. */
export const daemonCommandHelp: CommandHelp = {
  names: ['daemon'],
  summary: 'Ensure daemon is running; print its URL',
  additionalLines: [
    '  daemon --foreground   Run daemon in foreground (for dev)',
    '  daemon stop           Stop the background daemon',
    '  daemon status         Show daemon PID, port, and health',
  ],
  shellLine: 'daemon status|stop                      Inspect or stop the daemon',
  examples: ['  clove daemon --foreground                 # run daemon in foreground (for dev)'],
};
