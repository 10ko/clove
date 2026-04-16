import { readDaemonState, stopDaemon, healthCheck } from '../../daemon.js';
import type { CliRuntime } from '../types.js';

export async function runDaemon(rest: string[], ctx: CliRuntime): Promise<boolean> {
  const sub = rest[0]?.toLowerCase();

  if (sub === 'stop') {
    const killed = await stopDaemon();
    console.log(killed ? 'Daemon stopped.' : 'No daemon was running.');
    if (killed) {
      console.log('This shell is no longer connected to a daemon. Exiting.');
      return true;
    }
    return false;
  }

  if (sub === 'status') {
    const state = readDaemonState();
    if (!state) {
      console.log('No daemon state file found.');
      return false;
    }
    const url = `http://localhost:${state.port}`;
    const alive = await healthCheck(url);
    console.log(`PID:        ${state.pid}`);
    console.log(`Port:       ${state.port}`);
    console.log(`Started at: ${state.startedAt}`);
    console.log(`Status:     ${alive ? 'healthy' : 'not reachable'}`);
    return false;
  }

  if (sub === '--foreground' || sub === '--listen') {
    console.log(
      'Foreground daemon cannot be started from the interactive shell. In another terminal run:',
    );
    console.log('  clove daemon --foreground');
    return false;
  }

  if (sub != null && sub !== '') {
    console.error('Unknown daemon subcommand. Try: daemon, daemon status, daemon stop');
    return false;
  }

  console.log(`Clove daemon running at ${ctx.daemonBaseUrl}`);
  return false;
}
