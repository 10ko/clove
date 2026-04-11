import * as readline from 'node:readline';
import type { ChildProcess } from 'node:child_process';
import { HttpCloveApi } from '../httpCloveApi.js';
import { ensureDaemonBaseUrl } from '../daemon.js';
import { tokenize } from './utils.js';
import { runCommand } from './router.js';
import type { StreamInterruptRef } from './types.js';

export async function runInteractiveShell(): Promise<void> {
  const daemonBaseUrl = await ensureDaemonBaseUrl();
  const api = new HttpCloveApi(daemonBaseUrl);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const streamInterruptRef: StreamInterruptRef = { current: null };
  const dashboardChildRef = { current: null as ChildProcess | null };

  process.on('SIGINT', () => {
    if (streamInterruptRef.current) {
      streamInterruptRef.current();
      streamInterruptRef.current = null;
    } else {
      if (dashboardChildRef.current) {
        try { dashboardChildRef.current.kill(); } catch { /* ignore */ }
        dashboardChildRef.current = null;
      }
      process.exit(0);
    }
  });

  console.log(`Connected to daemon at ${daemonBaseUrl}`);
  console.log('clove – interactive shell. Type "help" for commands, "exit" to quit.\n');

  const loop = (): void => {
    rl.question('clove> ', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        loop();
        return;
      }
      const tokens = tokenize(trimmed);
      const [cmd, ...rest] = tokens;
      if (!cmd) {
        loop();
        return;
      }
      try {
        const shouldExit = await runCommand(cmd.toLowerCase(), rest, {
          api,
          daemonBaseUrl,
          singleShot: false,
          streamInterruptRef,
          dashboardChildRef,
        });
        if (shouldExit) {
          rl.close();
          process.exit(0);
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
      }
      loop();
    });
  };
  loop();
}
