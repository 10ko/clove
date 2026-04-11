import path from 'node:path';
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
