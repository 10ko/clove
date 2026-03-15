# Clove Dashboard

Web UI for listing agents, viewing live stream output, and sending input. Uses the same API as the CLI.

## Run the dashboard

### Option A: Dev (Vite + proxy)

1. Start the API server in one terminal:
   ```bash
   clove serve
   ```
   (or `npm run dev -- serve`)
2. Start the dashboard in another:
   ```bash
   clove dashboard
   ```
   (or `npm run dashboard:dev`)
3. Open http://localhost:5173. Vite proxies `/api` to the Clove server (port 3000).

### Option B: Single server (built dashboard)

1. Build the dashboard:
   ```bash
   npm run dashboard:build
   ```
2. Start the server (serves both API and dashboard):
   ```bash
   npm run dev -- serve
   ```
3. Open http://localhost:3000. The server serves the built dashboard from `dashboard/dist` and the API at `/api`.

## Features

- **Start agent** — Form: repo path and prompt; calls `POST /api/agents/start`.
- **Agent list** — Polls `GET /api/agents` every 3s; shows agent id, status, workspace path; **Stop** calls `POST /api/agents/:id/stop`.
- **Detail view** — Click an agent: opens a panel with live **stream** (SSE from `GET /api/agents/:id/stream`) and **Send input** (form → `POST /api/agents/:id/input`).

## Stack

- Vite + React + TypeScript
- Fetch for REST; `EventSource` for SSE stream
- Dark theme (Tailwind-style colors via inline styles)
