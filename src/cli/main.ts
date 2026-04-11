import { HttpCloveApi } from '../httpCloveApi.js';
import {
  ensureDaemonBaseUrl,
  runDaemonListen,
  readDaemonState,
  stopDaemon,
} from '../daemon.js';
import { runInteractiveShell } from './shell.js';
import { runDashboard } from './dashboard.js';
import { runCommand, ONE_SHOT_COMMANDS, printFullHelp } from './router.js';

export async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printFullHelp();
    process.exit(0);
  }

  const first = rawArgs[0];

  if (first === 'daemon') {
    const sub = rawArgs[1];

    if (sub === 'stop') {
      const killed = await stopDaemon();
      console.log(killed ? 'Daemon stopped.' : 'No daemon was running.');
      process.exit(0);
    }

    if (sub === 'status') {
      const state = readDaemonState();
      if (!state) {
        console.log('No daemon state file found.');
        process.exit(0);
      }
      const url = `http://localhost:${state.port}`;
      const alive = await (await import('../daemon.js')).healthCheck(url);
      console.log(`PID:        ${state.pid}`);
      console.log(`Port:       ${state.port}`);
      console.log(`Started at: ${state.startedAt}`);
      console.log(`Status:     ${alive ? 'healthy' : 'not reachable'}`);
      process.exit(0);
    }

    if (rawArgs.includes('--foreground') || rawArgs.includes('--listen')) {
      await runDaemonListen();
      await new Promise<void>(() => {});
      return;
    }

    const base = await ensureDaemonBaseUrl();
    console.log(`Clove daemon running at ${base}`);
    process.exit(0);
  }

  if (
    rawArgs.length === 0 ||
    first === 'shell' ||
    first === 'i' ||
    first === 'repl'
  ) {
    await runInteractiveShell();
    return;
  }

  if (first === 'dashboard') {
    const daemonBaseUrl = await ensureDaemonBaseUrl();
    await runDashboard(daemonBaseUrl, { exitOnClose: true });
    return;
  }

  const [command, ...rest] = rawArgs;
  const cmdLower = command!.toLowerCase();
  const allowed = ONE_SHOT_COMMANDS as readonly string[];
  if (!allowed.includes(cmdLower)) {
    console.error(`clove: unknown command "${command}"`);
    printFullHelp();
    process.exit(1);
  }

  const daemonBaseUrl = await ensureDaemonBaseUrl();
  const api = new HttpCloveApi(daemonBaseUrl);

  try {
    const shouldExit = await runCommand(cmdLower, rest, {
      api,
      daemonBaseUrl,
      singleShot: true,
    });
    process.exit(shouldExit ? 0 : 0);
  } catch (err) {
    console.error('clove:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
