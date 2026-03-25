/**
 * CLI entry point. Always talks to the daemon over HTTP.
 * If no daemon is running, starts one in the background automatically.
 *
 * Commands: start, stop, stream, send-input, list, dashboard, daemon, help, exit/quit.
 * `bun run dev:daemon` runs the daemon in the foreground for development.
 */

import * as readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HttpCloveApi } from './httpCloveApi.js';
import { ensureDaemonBaseUrl, runDaemonListen, clearDaemonState, readDaemonState, stopDaemon } from './daemon.js';
import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator';

function generateMemorableId(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    length: 2,
    separator: '-',
    style: 'lowerCase',
  });
}

const HELP = `
clove – orchestrate multiple AI coding agents

USAGE
  clove                    Start interactive shell (connects to daemon)
  clove [COMMAND] ...      Run a single command against the daemon

COMMANDS
  start       Start an agent (repo required; prompt optional)
  stop        Stop a running agent
  stream      Stream logs and agent output
  send-input  Send input to a running agent
  list        List agents and status
  dashboard   Open dashboard in browser
  daemon      Ensure daemon is running; print its URL
  daemon --foreground   Run daemon in foreground (for dev)
  daemon stop           Stop the background daemon
  daemon status         Show daemon PID, port, and health
  help        Show this help
  exit, quit  Exit the shell (shell only)

OPTIONS
  -h, --help  Show this help

EXAMPLES
  clove                                     # interactive shell (starts daemon if needed)
  clove start --repo . --prompt "Add tests" # one-shot command
  clove list
  clove dashboard
  clove daemon                              # ensure daemon is running
  clove daemon --foreground                 # run daemon in foreground (for dev)
`.trim();

const SHELL_HELP = `
  start --repo <path> [--agent-id <id>] [--branch <name>] [--prompt "<text>"] [--runtime local] [--agent cursor]
  list                                    List running agents
  stream <agent-id>                       Stream agent output (Ctrl+C to exit stream)
  send-input <agent-id> "<input>"         Send input to agent
  stop <agent-id>                         Stop an agent
  dashboard                               Open dashboard in browser
  help                                    Show help
  exit, quit                              Exit shell
`.trim();

function getArg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i])) i++;
    if (i >= line.length) break;
    if (line[i] === '"') {
      i++;
      let end = i;
      while (end < line.length && line[end] !== '"') {
        if (line[end] === '\\') end++;
        end++;
      }
      tokens.push(line.slice(i, end).replace(/\\(.)/g, '$1'));
      i = end + 1;
    } else {
      let end = i;
      while (end < line.length && !/\s/.test(line[end])) end++;
      tokens.push(line.slice(i, end));
      i = end;
    }
  }
  return tokens;
}

function isCompiledBinary(): boolean {
  return path.basename(process.execPath).startsWith('clove');
}

function parseSourceRepo(repo: string): { type: 'path'; path: string } | { type: 'url'; url: string } {
  const trimmed = repo.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('git@')) {
    return { type: 'url', url: trimmed };
  }
  return { type: 'path', path: trimmed };
}

function openBrowser(url: string): void {
  const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [url], { stdio: 'ignore', shell: true }).unref();
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function runDashboard(
  daemonBaseUrl: string,
  options?: { exitOnClose?: boolean; dashboardChildRef?: { current: ChildProcess | null } }
): Promise<void> {
  const exitOnClose = options?.exitOnClose ?? false;
  const dashboardChildRef = options?.dashboardChildRef;
  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const execDir = path.dirname(process.execPath);
  const dashboardDir = isCompiledBinary()
    ? path.join(execDir, 'dashboard')
    : path.join(cliDir, '..', 'dashboard');

  // Compiled binary: dashboard is served by the daemon; just open browser.
  if (isCompiledBinary()) {
    console.log(`Dashboard at ${daemonBaseUrl}\n`);
    openBrowser(daemonBaseUrl);
    console.log('Dashboard opened in browser.\n');
    if (exitOnClose) {
      await new Promise<void>(() => {});
    }
    return;
  }

  // Dev: start Vite with VITE_CLOVE_API_URL pointing at the daemon.
  if (!fs.existsSync(dashboardDir)) {
    console.error('clove: dashboard not found at', dashboardDir);
    if (exitOnClose) process.exit(1);
    return;
  }
  const viteBin = path.join(dashboardDir, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteBin)) {
    console.error('clove: dashboard/node_modules/vite not found. Run: cd dashboard && bun install');
    if (exitOnClose) process.exit(1);
    return;
  }

  console.log(`API at ${daemonBaseUrl}`);
  console.log('Dashboard at http://localhost:5173\n');

  const dashboardBin = path.join(dashboardDir, 'node_modules', '.bin');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    VITE_CLOVE_API_URL: `${daemonBaseUrl}/api`,
  };
  delete env.NODE_PATH;
  if (process.env.PATH) {
    env.PATH = dashboardBin + path.delimiter + process.env.PATH;
  }

  const dashboardUrl = 'http://localhost:5173';

  const waitForUrl = (url: string, timeoutMs: number): Promise<void> =>
    new Promise((resolve) => {
      const start = Date.now();
      const tryFetch = (): void => {
        const req = http.get(url, () => resolve());
        req.on('error', () => {
          if (Date.now() - start < timeoutMs) setTimeout(tryFetch, 200);
          else resolve();
        });
        req.end();
      };
      tryFetch();
    });

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [viteBin], {
      cwd: dashboardDir,
      stdio: exitOnClose ? 'inherit' : 'ignore',
      env,
    });
    if (dashboardChildRef && !exitOnClose) dashboardChildRef.current = child;

    const onSignal = (): void => {
      try { child.kill(); } catch { /* ignore */ }
      process.exit(0);
    };

    if (exitOnClose) {
      process.on('SIGINT', onSignal);
      process.on('SIGTERM', onSignal);
    }

    child.on('exit', (code) => {
      if (dashboardChildRef) dashboardChildRef.current = null;
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      if (exitOnClose) process.exit(code ?? 0);
      else resolve();
    });
    child.on('error', (err) => {
      console.error('clove:', err.message);
      if (exitOnClose) process.exit(1);
      else reject(err);
    });

    if (!exitOnClose) {
      waitForUrl(dashboardUrl, 10000).then(() => {
        setTimeout(() => {
          openBrowser(dashboardUrl);
          console.log('Dashboard opened in browser. You can keep using the shell.\n');
          resolve();
        }, 2500);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Run a single command
// ---------------------------------------------------------------------------

type StreamInterruptRef = { current: (() => void) | null };

async function runCommand(
  command: string,
  rest: string[],
  api: HttpCloveApi,
  daemonBaseUrl: string,
  singleShot: boolean,
  streamInterruptRef?: StreamInterruptRef,
  dashboardChildRef?: { current: ChildProcess | null }
): Promise<boolean> {
  if (command === 'list') {
    const agents = await api.listAgents();
    if (agents.length === 0) {
      console.log('No agents.');
      return false;
    }
    for (const a of agents) {
      const state = a.agentState ? ` (${a.agentState})` : '';
      console.log(`${a.agentId}  ${a.status}${state}  ${a.workspacePath}`);
    }
    return false;
  }

  if (command === 'start') {
    const repo = getArg(rest, '--repo');
    const prompt = getArg(rest, '--prompt') ?? '';
    const agentId = getArg(rest, '--agent-id') ?? generateMemorableId();
    const branchName = getArg(rest, '--branch');
    const runtimeKey = getArg(rest, '--runtime') ?? 'local';
    const pluginKey = getArg(rest, '--agent') ?? getArg(rest, '--plugin') ?? 'cursor';
    if (!repo) {
      console.error('start requires --repo <path-or-url>');
      return false;
    }
    const sourceRepo = parseSourceRepo(repo);
    const result = await api.startAgent({
      agentId,
      sourceRepo,
      runtimeKey,
      pluginKey,
      prompt,
      ...(branchName != null && branchName !== '' && { branchName }),
    });
    console.log(`Started agent ${agentId} (runtime=${runtimeKey}, agent=${pluginKey})`);
    console.log(`  workspace: ${result.path}`);
    console.log(`  branch: ${result.branch}`);
    return false;
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(singleShot ? HELP : SHELL_HELP);
    return false;
  }

  if (command === 'exit' || command === 'quit') {
    return true;
  }

  if (command === 'dashboard') {
    await runDashboard(daemonBaseUrl, {
      exitOnClose: singleShot,
      ...(dashboardChildRef && { dashboardChildRef }),
    });
    return false;
  }

  const agentId = rest[0];
  if (!agentId) {
    console.error(`${command} requires <agent-id>`);
    return false;
  }

  if (command === 'stop') {
    await api.stopAgent(agentId);
    console.log(`Stopped agent ${agentId}`);
    return false;
  }

  if (command === 'send-input') {
    const input = rest.slice(1).join(' ').trim();
    if (!input) {
      console.error('send-input requires <agent-id> <input>');
      return false;
    }
    await api.sendInput(agentId, input);
    console.log(`Sent input to ${agentId}`);
    return false;
  }

  if (command === 'stream') {
    const STREAM_IDLE_MS = 3000;
    const stream = api.stream(agentId);
    const it = stream[Symbol.asyncIterator]();
    let idleTimeout: ReturnType<typeof setTimeout> | null = null;
    let timedOut = false;
    let interrupted = false;
    const nextWithTimeout = (): Promise<IteratorResult<{ payload: string }>> =>
      new Promise((resolve, reject) => {
        idleTimeout = setTimeout(() => {
          timedOut = true;
          resolve({ value: undefined, done: true });
        }, STREAM_IDLE_MS);
        it.next().then((result) => {
          if (idleTimeout) clearTimeout(idleTimeout);
          resolve(result);
        }, reject);
      });
    const interruptPromise = new Promise<IteratorResult<{ payload: string }>>((resolve) => {
      if (streamInterruptRef) {
        streamInterruptRef.current = () => {
          interrupted = true;
          resolve({ value: undefined, done: true });
        };
      }
    });
    try {
      while (true) {
        const result = await (streamInterruptRef
          ? Promise.race([nextWithTimeout(), interruptPromise])
          : nextWithTimeout());
        if (result.done) break;
        if (result.value?.payload) process.stdout.write(result.value.payload);
      }
      if (interrupted) {
        console.log('\n(Ctrl+C — left stream; agent still running)');
      } else if (timedOut) {
        console.log('\n(no new output for 3s — agent still running; run "stream <id>" again to see more)');
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
    } finally {
      if (streamInterruptRef) streamInterruptRef.current = null;
    }
    return false;
  }

  console.error(`Unknown command "${command}". Type 'help' for usage.`);
  return false;
}

// ---------------------------------------------------------------------------
// Interactive shell
// ---------------------------------------------------------------------------

async function runInteractiveShell(): Promise<void> {
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
      if (!trimmed) { loop(); return; }
      const tokens = tokenize(trimmed);
      const [cmd, ...rest] = tokens;
      if (!cmd) { loop(); return; }
      try {
        const shouldExit = await runCommand(
          cmd.toLowerCase(), rest, api, daemonBaseUrl, false, streamInterruptRef, dashboardChildRef
        );
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  const first = rawArgs[0];

  // daemon subcommands
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
      const alive = await (await import('./daemon.js')).healthCheck(url);
      console.log(`PID:        ${state.pid}`);
      console.log(`Port:       ${state.port}`);
      console.log(`Started at: ${state.startedAt}`);
      console.log(`Status:     ${alive ? 'healthy' : 'not reachable'}`);
      process.exit(0);
    }

    if (rawArgs.includes('--foreground') || rawArgs.includes('--listen')) {
      await runDaemonListen();
      process.on('SIGINT', () => { clearDaemonState(); process.exit(0); });
      process.on('SIGTERM', () => { clearDaemonState(); process.exit(0); });
      await new Promise<void>(() => {});
      return;
    }

    const base = await ensureDaemonBaseUrl();
    console.log(`Clove daemon running at ${base}`);
    process.exit(0);
  }

  // No args → interactive shell (auto-starts daemon if needed)
  if (
    rawArgs.length === 0 ||
    first === 'shell' ||
    first === 'i' ||
    first === 'repl'
  ) {
    await runInteractiveShell();
    return;
  }

  // dashboard
  if (first === 'dashboard') {
    const daemonBaseUrl = await ensureDaemonBaseUrl();
    await runDashboard(daemonBaseUrl, { exitOnClose: true });
    return;
  }

  // One-shot commands: connect to daemon and run
  const knownCommands = ['start', 'stop', 'stream', 'send-input', 'list', 'help'];
  const [command, ...rest] = rawArgs;
  if (!knownCommands.includes(command)) {
    console.error(`clove: unknown command "${command}"`);
    console.log(HELP);
    process.exit(1);
  }

  const daemonBaseUrl = await ensureDaemonBaseUrl();
  const api = new HttpCloveApi(daemonBaseUrl);

  try {
    const shouldExit = await runCommand(command, rest, api, daemonBaseUrl, true);
    process.exit(shouldExit ? 0 : 0);
  } catch (err) {
    console.error('clove:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
