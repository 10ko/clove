import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import dashboardZip from './embedded/dashboard.dist.zip' with { type: 'file' };
import { isCompiledBinary } from './cli/utils.js';

let cachedDir: string | null = null;

export function extractEmbeddedDashboardDistDir(): string | null {
  if (!isCompiledBinary()) {
    return null;
  }
  if (cachedDir && fs.existsSync(path.join(cachedDir, 'index.html'))) {
    return cachedDir;
  }

  const zipRef = dashboardZip as unknown as string;
  if (!zipRef) {
    return null;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clove-dashboard-'));
  const tmpZip = path.join(os.tmpdir(), `clove-dashboard-src-${process.pid}-${Date.now()}.zip`);
  try {
    const zipBytes = fs.readFileSync(zipRef);
    fs.writeFileSync(tmpZip, zipBytes);
  } catch (e) {
    try {
      fs.rmSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
    throw e;
  }

  const r = spawnSync('unzip', ['-o', '-qq', tmpZip, '-d', dir], { encoding: 'utf-8' });
  try {
    fs.unlinkSync(tmpZip);
  } catch {
    /* ignore */
  }
  if (r.error != null) {
    try {
      fs.rmSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
    throw r.error;
  }
  if (r.status !== 0) {
    try {
      fs.rmSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
    throw new Error(r.stderr || `unzip exited with status ${r.status}`);
  }

  const indexHtml = path.join(dir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    try {
      fs.rmSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
    throw new Error('embedded dashboard zip did not contain index.html');
  }

  cachedDir = dir;
  return dir;
}
