import path from 'node:path';
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator';

export function generateMemorableId(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    length: 2,
    separator: '-',
    style: 'lowerCase',
  });
}

export function getArg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

export function tokenize(line: string): string[] {
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

export function isCompiledBinary(): boolean {
  return path.basename(process.execPath).startsWith('clove');
}

function tryRealpath(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

/** How the user invoked clove (absolute path to wrapper or binary when on PATH). */
function argv0ResolvedPath(): string | null {
  const a0 = process.argv[0];
  if (!a0) return null;
  if (path.isAbsolute(a0)) return a0;
  if (a0.startsWith('./') || a0.startsWith('../')) {
    return path.resolve(process.cwd(), a0);
  }
  if (process.platform === 'win32') {
    try {
      const out = execSync(`where ${JSON.stringify(a0)}`, { encoding: 'utf8' }).split(/\r?\n/)[0];
      return out?.trim() || null;
    } catch {
      return null;
    }
  }
  try {
    const out = execSync(`command -v ${JSON.stringify(a0)}`, {
      encoding: 'utf8',
      shell: '/bin/sh',
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Directory that contains `clove-macos-arm64` and `dashboard/` (matches the release zip layout).
 * Homebrew uses `bin/clove` as a wrapper; real files live in `../libexec`.
 * Prefer argv[0] + PATH resolution: Bun's `process.execPath` can point at a path that does not
 * work for `posix_spawn` even when the process is running.
 */
export function compiledInstallLibexecDir(): string {
  const fromArgv = argv0ResolvedPath();
  if (fromArgv) {
    const inv = tryRealpath(fromArgv) ?? fromArgv;
    const base = path.basename(inv);
    const dir = path.dirname(inv);
    if (base === 'clove') {
      return path.resolve(dir, '..', 'libexec');
    }
    if (base === 'clove-macos-arm64') {
      return dir;
    }
  }

  const execPath = process.execPath;
  const dir = path.dirname(execPath);
  if (path.basename(execPath) === 'clove') {
    return path.resolve(dir, '..', 'libexec');
  }
  return path.resolve(dir);
}

/** Executable to spawn for `daemon --listen` (real binary, or Homebrew wrapper). */
export function compiledCloveExecutable(): string {
  const libexec = compiledInstallLibexecDir();

  const real = path.join(libexec, 'clove-macos-arm64');
  const realRp = tryRealpath(real);
  if (realRp && fs.statSync(realRp).isFile()) {
    return realRp;
  }

  const wrap = path.join(libexec, '..', 'bin', 'clove');
  const wrapRp = tryRealpath(wrap);
  if (wrapRp && fs.statSync(wrapRp).isFile()) {
    return wrapRp;
  }

  const argv0 = argv0ResolvedPath();
  if (argv0) {
    const ar = tryRealpath(argv0) ?? argv0;
    if (fs.existsSync(ar) && fs.statSync(ar).isFile()) {
      return ar;
    }
  }

  return process.execPath;
}

export function parseSourceRepo(repo: string): { type: 'path'; path: string } | { type: 'url'; url: string } {
  const trimmed = repo.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('git@')) {
    return { type: 'url', url: trimmed };
  }
  return { type: 'path', path: trimmed };
}

export function openBrowser(url: string): void {
  const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [url], { stdio: 'ignore', shell: true }).unref();
}
