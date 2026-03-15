/**
 * CLI entry point. Interactive shell or single commands: start, stop, stream, send-input, list, serve, dashboard.
 */

import * as readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCursorAgent } from './plugins/agent/cursor.js';
import { createLocalRuntime } from './plugins/runtime/local.js';
import { createDockerRuntime } from './plugins/runtime/docker.js';
import { WorkspaceManager } from './workspaceManager.js';
import { Orchestrator } from './orchestrator.js';
import { CloveApi } from './api.js';
import { createServer, runServer } from './server.js';

const HELP = `
clove – orchestrate multiple AI coding agents

USAGE
  clove                    Start interactive shell (default)
  clove [COMMAND] ...      Run a single command and exit

COMMANDS
  start       Start an agent (runtime, plugin, prompt)
  stop        Stop a running agent
  stream      Stream logs and agent output
  send-input  Send input to a running agent
  list        List agents and status
  serve       Start HTTP API server (for dashboard)
  dashboard   Start dashboard dev server (Vite)
  help        Show this help
  exit, quit  Exit the shell (shell only)

OPTIONS
  -h, --help  Show this help

EXAMPLES
  clove
  clove> start --repo . --prompt "Add tests for auth"
  clove> list
  clove> stream agent-123
  clove> exit

  clove serve --port 3000   # API at http://localhost:3000
  clove dashboard           # Dashboard at http://localhost:5173 (run "clove serve" in another terminal)
  clove list
  clove start --repo . --prompt "hello"
`.trim();

const SHELL_HELP = `
  start --repo <path|url> --prompt "<text>" [--runtime local|docker] [--agent cursor]
  list                                    List running agents
  stream <agent-id>                       Stream agent output (Ctrl+C to exit stream)
  send-input <agent-id> "<input>"         Send input to agent
  stop <agent-id>                         Stop an agent
  dashboard                               Start dashboard (Vite dev server)
  help                                    Show help
  exit, quit                              Exit shell (stops all agents)
`.trim();

function getArg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

/** Parse a line into tokens, respecting double-quoted strings. */
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

function runDashboard(options?: {
  exitOnClose?: boolean;
  dashboardChildRef?: { current: ChildProcess | null };
}): Promise<void> {
  const exitOnClose = options?.exitOnClose ?? false;
  const dashboardChildRef = options?.dashboardChildRef;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dashboardDir = path.join(__dirname, '..', 'dashboard');
  if (!fs.existsSync(dashboardDir)) {
    console.error('clove: dashboard not found at', dashboardDir);
    if (exitOnClose) process.exit(1);
    return Promise.resolve();
  }
  const packageJson = path.join(dashboardDir, 'package.json');
  if (!fs.existsSync(packageJson)) {
    console.error('clove: dashboard/package.json not found. Run npm install in the project first.');
    if (exitOnClose) process.exit(1);
    return Promise.resolve();
  }

  const viteBin = path.join(dashboardDir, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(viteBin)) {
    console.error('clove: dashboard/node_modules/vite not found. Run: cd dashboard && npm install');
    if (exitOnClose) process.exit(1);
    return Promise.resolve();
  }

  let serverToClose: http.Server | null = null;
  const { server } = runServer(3000);
  serverToClose = server;
  server.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log('Port 3000 in use — using existing API server.');
      serverToClose = null;
    }
  });

  console.log('API at http://localhost:3000');
  console.log('Dashboard at http://localhost:5173\n');

  const dashboardBin = path.join(dashboardDir, 'node_modules', '.bin');
  const env = { ...process.env };
  delete env.NODE_PATH;
  if (process.env.PATH) {
    env.PATH = dashboardBin + path.delimiter + process.env.PATH;
  }

  const dashboardUrl = 'http://localhost:5173';

  const openBrowser = (url: string): void => {
    const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(cmd, [url], { stdio: 'ignore', shell: true }).unref();
  };

  const waitForServer = (url: string, timeoutMs: number): Promise<void> =>
    new Promise((resolve) => {
      const start = Date.now();
      const tryFetch = (): void => {
        const req = http.get(url, () => {
          resolve();
        });
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

    const cleanup = (): void => {
      try {
        if (serverToClose) serverToClose.close();
      } catch {
        // ignore
      }
      try {
        child.kill();
      } catch {
        // ignore
      }
    };

    const onExit = (code: number | null): void => {
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      if (serverToClose) serverToClose.close();
      if (exitOnClose) process.exit(code ?? 0);
      else resolve();
    };

    const onSignal = (): void => {
      cleanup();
      process.exit(0);
    };

    if (exitOnClose) {
      process.on('SIGINT', onSignal);
      process.on('SIGTERM', onSignal);
    }

    child.on('exit', (code) => {
      if (dashboardChildRef) dashboardChildRef.current = null;
      onExit(code);
    });
    child.on('error', (err) => {
      console.error('clove:', err.message);
      if (serverToClose) serverToClose.close();
      if (exitOnClose) process.exit(1);
      else reject(err);
    });

    if (!exitOnClose) {
      waitForServer(dashboardUrl, 10000).then(() => {
        // Give Vite time to compile before opening the browser
        setTimeout(() => {
          openBrowser(dashboardUrl);
          console.log('Dashboard opened in browser. You can keep using the shell.\n');
          resolve();
        }, 2500);
      });
    }
  });
}

function createApi(): CloveApi {
  const orchestrator = new Orchestrator({
    workspaceManager: new WorkspaceManager(),
    runtimes: {
      local: createLocalRuntime(),
      docker: createDockerRuntime(),
    },
    plugins: {
      cursor: () => createCursorAgent(),
    },
  });
  return new CloveApi(orchestrator);
}

function parseSourceRepo(repo: string): { type: 'path'; path: string } | { type: 'url'; url: string } {
  const trimmed = repo.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('git@')) {
    return { type: 'url', url: trimmed };
  }
  return { type: 'path', path: trimmed };
}

/** Ref used to interrupt the stream from SIGINT (Ctrl+C). Set by stream command, cleared when done. */
type StreamInterruptRef = { current: (() => void) | null };

/** Run a single command. Returns true if shell should exit (e.g. "exit" in shell). */
async function runCommand(
  command: string,
  rest: string[],
  api: CloveApi,
  singleShot: boolean,
  streamInterruptRef?: StreamInterruptRef,
  dashboardChildRef?: { current: ChildProcess | null }
): Promise<boolean> {
  if (command === 'list') {
    const agents = api.listAgents();
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
    const prompt = getArg(rest, '--prompt');
    const agentId = getArg(rest, '--agent-id') ?? `agent-${Date.now()}`;
    const runtimeKey = getArg(rest, '--runtime') ?? 'local';
    const pluginKey = getArg(rest, '--agent') ?? getArg(rest, '--plugin') ?? 'cursor';
    if (!repo || !prompt) {
      console.error('start requires --repo <path-or-url> and --prompt <text>');
      return false;
    }
    const sourceRepo = parseSourceRepo(repo);
    if (runtimeKey === 'docker' && sourceRepo.type !== 'url') {
      console.error('Docker runtime requires a repo URL (e.g. https://github.com/org/repo)');
      return false;
    }
    const result = await api.startAgent({
      agentId,
      sourceRepo,
      runtimeKey,
      pluginKey,
      prompt,
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
    if (!singleShot) {
      const agents = api.listAgents();
      for (const a of agents) {
        try {
          await api.stopAgent(a.agentId);
          console.log(`Stopped ${a.agentId}`);
        } catch {
          // ignore
        }
      }
    }
    return true;
  }

  if (command === 'dashboard') {
    await runDashboard({
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

function runInteractiveShell(): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const api = createApi();
  const streamInterruptRef: StreamInterruptRef = { current: null };

  const dashboardChildRef = { current: null as ChildProcess | null };

  const stopAllAgentsAndExit = async (): Promise<void> => {
    if (dashboardChildRef.current) {
      try {
        dashboardChildRef.current.kill();
      } catch {
        // ignore
      }
      dashboardChildRef.current = null;
    }
    for (const a of api.listAgents()) {
      try {
        await api.stopAgent(a.agentId);
      } catch {
        // ignore
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', () => {
    if (streamInterruptRef.current) {
      streamInterruptRef.current();
      streamInterruptRef.current = null;
    } else {
      void stopAllAgentsAndExit();
    }
  });

  const server = createServer(api);
  server.listen(3000, () => {
    console.log('API at http://localhost:3000');
  });
  server.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log('Port 3000 in use — API may already be running.');
    }
  });

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
        const shouldExit = await runCommand(cmd.toLowerCase(), rest, api, false, streamInterruptRef, dashboardChildRef);
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

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const showHelp =
    rawArgs.length === 0 ? false : rawArgs.includes('--help') || rawArgs.includes('-h');

  if (showHelp) {
    console.log(HELP);
    process.exit(0);
  }

  // No args or explicit "shell" → interactive shell
  const first = rawArgs[0];
  if (
    rawArgs.length === 0 ||
    first === 'shell' ||
    first === 'i' ||
    first === 'repl'
  ) {
    runInteractiveShell();
    return;
  }

  // serve: start HTTP server (single-command only)
  if (first === 'serve') {
    const port = parseInt(getArg(rawArgs.slice(1), '--port') ?? '3000', 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      console.error('clove: invalid --port');
      process.exit(1);
    }
    runServer(port);
    return;
  }

  // dashboard: start Vite dev server for the dashboard
  if (first === 'dashboard') {
    await runDashboard({ exitOnClose: true });
    return;
  }

  // Single-command mode
  const [command, ...rest] = rawArgs;
  const knownCommands = [
    'start',
    'stop',
    'stream',
    'send-input',
    'list',
    'serve',
    'dashboard',
    'help',
    'exit',
    'quit',
  ];
  if (!knownCommands.includes(command)) {
    console.error(`clove: unknown command "${command}"`);
    console.log(HELP);
    process.exit(1);
  }

  const api = createApi();

  try {
    const shouldExit = await runCommand(command, rest, api, true);
    process.exit(shouldExit ? 0 : 0);
  } catch (err) {
    console.error('clove:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
