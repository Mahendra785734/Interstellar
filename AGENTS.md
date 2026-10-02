# Base44 Dev Environment

## Project Overview
Interstellar — a Node.js/Express web proxy application. Entry point is `index.js`.

## Stack
- **Runtime:** Node.js 22 (via `node:22-bookworm-slim`)
- **Package manager:** pnpm (pinned via `packageManager` field in package.json; corepack-enabled in compose)
- **Framework:** Express + bare-server-node + wisp-js
- **Static files:** served from `static/` directory

## Running
```bash
docker compose -f docker-compose.base44.yml up -d
```
App listens on container port 8080, mapped to host port 3000.

## Dev mode
- `node --watch index.js` provides live reload on server file changes.
- Static files (HTML/CSS/JS in `static/`) are served directly from disk — changes appear on browser refresh without restart.
- After editing `index.js` or `config.js`, the `--watch` flag auto-restarts the server.

## Configuration
- `config.js` controls password protection (`challenge: false` by default = no auth).
- No external secrets or credentials are required to boot.

## Health
- Healthcheck: `GET /` returns 200 with `index.html`.
- Verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/`
