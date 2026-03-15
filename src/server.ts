/**
 * HTTP server exposing the unified API (Phase 3) and optional dashboard (Phase 4).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CloveApi } from './api.js';
import { Orchestrator } from './orchestrator.js';
import { WorkspaceManager } from './workspaceManager.js';
import { createLocalRuntime } from './plugins/runtime/local.js';
import { createDockerRuntime } from './plugins/runtime/docker.js';
import { createCursorAgent } from './plugins/agent/cursor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = path.resolve(__dirname, '../../dashboard/dist');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(
  res: http.ServerResponse,
  status: number,
  body: unknown
): void {
  res.writeHead(status, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(body));
}

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? (JSON.parse(data) as Record<string, unknown>) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function createServer(api: CloveApi): http.Server {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    const url = req.url ?? '/';
    const pathname = url.split('?')[0] ?? '/';
    const pathParts = pathname.replace(/^\/+/, '').split('/');
    const base = pathParts[0];
    const sub = pathParts[1];
    const id = pathParts[2];

    try {
      // POST /api/agents/start
      if (req.method === 'POST' && base === 'api' && sub === 'agents' && pathParts[2] === 'start') {
        const body = await parseBody(req);
        const repoPath = body.repoPath as string | undefined;
        const repoUrl = body.repoUrl as string | undefined;
        const prompt = body.prompt as string | undefined;
        const agentId = (body.agentId as string | undefined) ?? `agent-${Date.now()}`;
        const runtimeKey = (body.runtimeKey as string | undefined) ?? 'local';
        const pluginKey = (body.pluginKey as string | undefined) ?? 'cursor';
        const repo = repoUrl ?? repoPath;
        if (!repo || !prompt) {
          jsonResponse(res, 400, { error: 'repoPath or repoUrl, and prompt required' });
          return;
        }
        const sourceRepo =
          repoUrl != null
            ? { type: 'url' as const, url: repoUrl }
            : { type: 'path' as const, path: repoPath! };
        const result = await api.startAgent({
          agentId,
          sourceRepo,
          runtimeKey,
          pluginKey,
          prompt,
        });
        jsonResponse(res, 200, result);
        return;
      }

      // GET /api/agents
      if (req.method === 'GET' && base === 'api' && sub === 'agents' && !id) {
        const agents = api.listAgents();
        jsonResponse(res, 200, { agents });
        return;
      }

      // POST /api/agents/:id/stop
      if (req.method === 'POST' && base === 'api' && sub === 'agents' && id && pathParts[3] === 'stop') {
        await api.stopAgent(id);
        jsonResponse(res, 200, { ok: true });
        return;
      }

      // POST /api/agents/:id/input
      if (req.method === 'POST' && base === 'api' && sub === 'agents' && id && pathParts[3] === 'input') {
        const body = await parseBody(req);
        const input = body.input as string | undefined;
        if (input === undefined) {
          jsonResponse(res, 400, { error: 'input required' });
          return;
        }
        await api.sendInput(id, input);
        jsonResponse(res, 200, { ok: true });
        return;
      }

      // GET /api/agents/:id/stream — SSE
      if (req.method === 'GET' && base === 'api' && sub === 'agents' && id && pathParts[3] === 'stream') {
        res.writeHead(200, {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        const stream = api.stream(id);
        for await (const envelope of stream) {
          res.write(`data: ${JSON.stringify(envelope)}\n\n`);
        }
        res.end();
        return;
      }

      // Dashboard: serve static files from dashboard/dist if present
      if (req.method === 'GET' && fs.existsSync(DASHBOARD_DIR)) {
        const filePath = pathParts.filter(Boolean).length > 0 ? path.join(DASHBOARD_DIR, ...pathParts.filter(Boolean)) : path.join(DASHBOARD_DIR, 'index.html');
        const resolved = path.resolve(filePath);
        const relative = path.relative(DASHBOARD_DIR, resolved);
        if (!relative.startsWith('..') && !path.isAbsolute(relative) && fs.existsSync(resolved)) {
          const stat = fs.statSync(resolved);
          if (stat.isFile()) {
            const ext = path.extname(resolved);
            const types: Record<string, string> = {
              '.html': 'text/html',
              '.js': 'application/javascript',
              '.css': 'text/css',
              '.ico': 'image/x-icon',
            };
            res.writeHead(200, { 'Content-Type': types[ext] ?? 'application/octet-stream' });
            fs.createReadStream(resolved).pipe(res);
            return;
          }
        }
        // SPA fallback: serve index.html for any other GET
        const indexHtml = path.join(DASHBOARD_DIR, 'index.html');
        if (fs.existsSync(indexHtml)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          fs.createReadStream(indexHtml).pipe(res);
          return;
        }
      }

      jsonResponse(res, 404, { error: 'Not found' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[clove]', req.method, pathname, err);
      jsonResponse(res, 500, { error: message });
    }
  });
}

export function runServer(port: number): { server: http.Server; api: CloveApi } {
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
  const api = new CloveApi(orchestrator);
  const server = createServer(api);
  server.listen(port, () => {
    console.log(`Clove server at http://localhost:${port}`);
    if (fs.existsSync(DASHBOARD_DIR)) {
      console.log('  Dashboard: http://localhost:' + port);
    }
    console.log('  API:');
    console.log('  GET  /api/agents           — list agents');
    console.log('  POST /api/agents/start     — start (body: { repoPath, prompt, agentId? })');
    console.log('  POST /api/agents/:id/stop  — stop agent');
    console.log('  POST /api/agents/:id/input — send input (body: { input })');
    console.log('  GET  /api/agents/:id/stream — SSE stream');
  });
  return { server, api };
}
