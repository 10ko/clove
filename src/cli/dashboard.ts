import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isCompiledBinary, compiledInstallLibexecDir, openBrowser } from './utils.js';

export async function runDashboard(
  daemonBaseUrl: string,
  options?: { exitOnClose?: boolean; dashboardChildRef?: { current: ChildProcess | null } }
): Promise<void> {
  const exitOnClose = options?.exitOnClose ?? false;
  const dashboardChildRef = options?.dashboardChildRef;
  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const dashboardDir = isCompiledBinary()
    ? path.join(compiledInstallLibexecDir(), 'dashboard')
    : path.join(cliDir, '..', '..', 'dashboard');

  if (isCompiledBinary()) {
    const dashboardUrl = new URL('/', daemonBaseUrl).href;
    console.log(`Dashboard: ${dashboardUrl}\n`);
    openBrowser(dashboardUrl);
    console.log('Dashboard opened in browser.\n');
    if (exitOnClose) {
      await new Promise<void>(() => {});
    }
    return;
  }

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
