import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
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

/**
 * Directory that contains `clove-macos-arm64` and `dashboard/` (matches the release zip layout).
 * Homebrew uses `bin/clove` as a wrapper; real files live in `../libexec`.
 */
export function compiledInstallLibexecDir(): string {
  const execPath = process.execPath;
  const dir = path.dirname(execPath);
  if (path.basename(execPath) === 'clove') {
    return path.resolve(dir, '..', 'libexec');
  }
  return path.resolve(dir);
}

/** Executable to spawn for `daemon --listen` (real binary, or wrapper if needed). */
export function compiledCloveExecutable(): string {
  const libexec = compiledInstallLibexecDir();
  const real = path.join(libexec, 'clove-macos-arm64');
  try {
    if (fs.existsSync(real)) {
      return fs.realpathSync(real);
    }
  } catch {
    /* ignore */
  }
  const wrap = path.join(libexec, '..', 'bin', 'clove');
  try {
    if (fs.existsSync(wrap)) {
      return fs.realpathSync(wrap);
    }
  } catch {
    /* ignore */
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
