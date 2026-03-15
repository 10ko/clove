# Clove

Orchestrate coding agents (local or Docker) with a CLI and dashboard.

## Commands

```bash
# Interactive shell (recommended)
npm run dev
# or: npx tsx src/cli.ts

# From the shell:
#   start --repo <path|url> --prompt "<text>" [--runtime local|docker] [--agent echo|delay|cursor]
#   list
#   stream <agent-id>
#   send-input <agent-id> "<input>"
#   stop <agent-id>
#   dashboard    # opens browser, keeps shell
#   help
#   exit
```

```bash
# One-off (no shell)
npm run dev -- serve --port 3000
npm run dev -- dashboard
npm run dev -- list
npm run dev -- start --repo . --prompt "hello"
```

## Dashboard

Run `dashboard` from the interactive shell; the app opens in your browser and the API runs on port 3000.
