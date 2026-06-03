# Deploying Nova to Render

Nova ships as **two** Render services:

| Service | Type | What it serves |
| --- | --- | --- |
| `nova-server` | Node web service | the API (`/api/chat`, `/api/tts`, `/api/health`) |
| `nova-client` | Static site | the built React client (`client/dist`) |

They live on different origins, so the client calls the server with an absolute
URL (`VITE_API_BASE`) and the server only accepts that origin via CORS
(`CLIENT_ORIGIN`). Wiring those two values together is the one manual step.

## Option A — Blueprint (recommended)

`render.yaml` is a ready-made Blueprint, but **Render reads `render.yaml` from
the repository root**, and Nova lives in `nova-avatar/`. So:

1. Copy `nova-avatar/render.yaml` to the repo root (it already sets
   `rootDir: nova-avatar`, so build paths resolve correctly).
2. In Render: **New → Blueprint**, pick this repo. Render creates both services.
3. Fill in the secret env vars (they're marked `sync: false`):
   - `nova-server`: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`
   - both: `CLIENT_ORIGIN` / `VITE_API_BASE` — see **Wiring** below.

## Option B — create services by hand

**Server** (Web Service):
- Root directory: `nova-avatar`
- Build: `npm install && npm run build:server`
- Start: `npm run start`
- Health check path: `/api/health`
- Env vars: `NODE_ENV=production`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-sonnet-4-6`,
  `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `CLIENT_ORIGIN` (see below).

**Client** (Static Site):
- Root directory: `nova-avatar`
- Build: `npm install && npm run build:client`
- Publish directory: `client/dist`
- Rewrite rule: `/*` → `/index.html` (SPA fallback)
- Env var: `VITE_API_BASE` (see below).

## Wiring CLIENT_ORIGIN ↔ VITE_API_BASE

Render assigns each service a URL like `https://<name>.onrender.com`.

1. Deploy both once to learn their URLs.
2. On **nova-client**, set `VITE_API_BASE` to the **server** URL
   (e.g. `https://nova-server.onrender.com`) and redeploy — Vite inlines this at
   build time, so a rebuild is required after changing it.
3. On **nova-server**, set `CLIENT_ORIGIN` to the **client** URL
   (e.g. `https://nova-client.onrender.com`). Comma-separate to allow several.

If the browser shows a CORS error, `CLIENT_ORIGIN` doesn't exactly match the
client's origin (scheme + host, no trailing slash).

## Notes

- **Keys never reach the browser** — they live only on `nova-server`.
- **Free tier** spins down when idle; the first request after a cold start is
  slow. The `/api/health` check keeps deploys honest.
- Rate limits (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`) and body size
  (`MAX_BODY_SIZE`) are env-tunable.
- The model lives at `client/public/models/nova.vrm` — commit a license-cleared
  model, or set `VITE_DEFAULT_MODEL_URL` to a CORS-friendly hosted `.vrm`.

## CI

`.github/workflows/nova-ci.yml` (at the repo root, scoped to `nova-avatar/**`)
runs `typecheck`, `build`, and `lint` on every push/PR that touches Nova.
