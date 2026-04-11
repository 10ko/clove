/**
 * Clove daemon: background HTTP server, PID/port in ~/.clove/daemon.json
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runServer } from './server.js';
import type { CloveApi } from './api.js';

interface DaemonState {
  pid: number;
  port: number;
  startedAt: string;
}

const CLOVE_DIR = path.join(os.homedir(), '.clove');
const DAEMON_FILE = path.join(CLOVE_DIR, 'daemon.json');

/** Repo root (directory containing package.json), for spawning the child with correct cwd. */
function getProjectRoot(): string {
  const cliFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(cliFile), '..');
}

function isCompiledBinary(): boolean {
  return path.basename(process.execPath).startsWith('clove');
}

export function readDaemonState(): DaemonState | null {
  try {
    const raw = fs.readFileSync(DAEMON_FILE, 'utf-8');
    return JSON.parse(raw) as DaemonState;
  } catch {
    return null;
  }
}

function writeDaemonState(port: number): void {
  fs.mkdirSync(CLOVE_DIR, { recursive: true });
  const state: DaemonState = {
    pid: process.pid,
    port,
    startedAt: new Date().toISOString(),
  };
  fs.writeFileSync(DAEMON_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function clearDaemonState(): void {
  try {
    fs.unlinkSync(DAEMON_FILE);
  } catch {
    // ignore
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function healthCheck(baseUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/info`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** Start HTTP server: prefer 3000, fall back to OS-assigned free port. */
function startDaemonServer(
  onListening: (port: number, api: CloveApi) => void
): void {
  let usedFallback = false;
  const tryPort = (port: number): void => {
    const { server, api } = runServer(port, (actualPort) => {
      onListening(actualPort, api);
    });
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && !usedFallback) {
        usedFallback = true;
        tryPort(0);
      } else {
        console.error('clove daemon:', err.message);
        process.exit(1);
      }
    });
  };
  tryPort(3000);
}

export async function runDaemonListen(): Promise<void> {
  return await new Promise<void>((resolve) => {
    startDaemonServer((port, api) => {
      writeDaemonState(port);
      console.log(`Clove daemon listening on http://localhost:${port}`);
      console.log(`  PID ${process.pid} — state: ${DAEMON_FILE}`);

      const gracefulShutdown = async (): Promise<void> => {
        console.log('\nClove daemon shutting down — pausing all agents...');
        try { await api.pauseAll(); } catch { /* best effort */ }
        clearDaemonState();
        process.exit(0);
      };
      process.on('SIGINT', () => { gracefulShutdown(); });
      process.on('SIGTERM', () => { gracefulShutdown(); });

      resolve();
    });
  });
}

const DAEMON_LOG = path.join(CLOVE_DIR, 'daemon.log');

function spawnDaemonChild(): void {
  const projectRoot = getProjectRoot();
  const exe = process.execPath;
  const thisFile = fileURLToPath(import.meta.url);
  const cliPath = path.join(path.dirname(thisFile), 'cli.ts');

  const args = isCompiledBinary()
    ? ['daemon', '--listen']
    : [cliPath, 'daemon', '--listen'];

  fs.mkdirSync(CLOVE_DIR, { recursive: true });
  const logFd = fs.openSync(DAEMON_LOG, 'a');

  const child = spawn(exe, args, {
    cwd: projectRoot,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env },
  });
  child.on('error', (err) => {
    console.error('clove: could not spawn daemon process:', err.message);
  });
  child.unref();
  fs.closeSync(logFd);
}

/** Stop the running daemon. Returns true if a daemon was killed. */
export async function stopDaemon(): Promise<boolean> {
  const state = readDaemonState();
  if (!state) {
    return false;
  }
  clearDaemonState();
  if (!isPidAlive(state.pid)) {
    return false;
  }

  try { process.kill(state.pid, 'SIGTERM'); } catch { return false; }

  // Wait up to 3s for graceful shutdown, then SIGKILL
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (!isPidAlive(state.pid)) return true;
  }
  try { process.kill(state.pid, 'SIGKILL'); } catch { /* already gone */ }
  return true;
}

/**
 * Ensure a daemon is running; return base URL (e.g. http://localhost:3000).
 * Uses existing daemon if healthy; otherwise spawns one.
 */
export async function ensureDaemonBaseUrl(): Promise<string> {
  const fromEnv = process.env.CLOVE_API_URL?.trim();
  if (fromEnv) {
    const base = fromEnv.replace(/\/$/, '');
    if (await healthCheck(base)) return base;
    throw new Error(`CLOVE_API_URL is set but not reachable: ${base}`);
  }

  const state = readDaemonState();
  if (state && isPidAlive(state.pid)) {
    const base = `http://localhost:${state.port}`;
    if (await healthCheck(base)) return base;
  }

  clearDaemonState();
  spawnDaemonChild();

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const s = readDaemonState();
    if (s) {
      const base = `http://localhost:${s.port}`;
      if (await healthCheck(base)) return base;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  throw new Error('Could not start or reach Clove daemon. Try: clove daemon --listen');
}
