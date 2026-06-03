# Nova — Conversational 3D AI Avatar

A VRM avatar that **chats** (Anthropic, streamed), **speaks** (ElevenLabs TTS),
and **lip-syncs to real audio amplitude** — with blinking, idle motion, gaze
tracking, and emotion-reactive expressions.

A thin React client does all the rendering; a thin Express server proxies the
two external APIs. The server exists for two concrete reasons:

1. **Key security** — the Anthropic and ElevenLabs keys never reach the browser.
2. **Analysable audio** — routing real TTS bytes back to the client lets an
   `AnalyserNode` read true amplitude, so the mouth tracks the actual speech
   instead of a timer.

```
Client (Vite/React/TS)                      Server (Node/Express/TS)
  Chat UI ──user message──▶  POST /api/chat (SSE) ──▶ Anthropic Messages API
        ◀──streamed tokens──
  reply text ──────────────▶ POST /api/tts (bytes) ─▶ ElevenLabs TTS
  Web Audio AnalyserNode ◀── audio buffer
        │
        ▼
  three-vrm renderer (aa/ih/ou visemes, blink, gaze, emotion)
```

## Quick start

```bash
cd nova-avatar
cp .env.example .env          # fill in ANTHROPIC_* and ELEVENLABS_*
# drop a license-cleared model at client/public/models/nova.vrm
npm install
npm run dev                   # client on :5173, server on :8787
```

Open http://localhost:5173. Without keys the app still boots and renders the
avatar; `/api/chat` and `/api/tts` return 503 until configured.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run client + server together |
| `npm run build` | Production build of both workspaces |
| `npm run start` | Run the built server (serves the API) |
| `npm run typecheck` | `tsc --noEmit` for both workspaces |
| `npm run lint` | ESLint |
| `npm run format` | Prettier --write |

## Environment

See `.env.example`. Keys (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`,
`ELEVENLABS_VOICE_ID`) are required in production — the server fails fast at
startup if they're missing when `NODE_ENV=production`, and warns (but boots) in
development.

## Deploy (Render)

See [`docs/DEPLOY.md`](./docs/DEPLOY.md). In short: the client deploys as a
static site, the server as a web service, and `render.yaml` wires both up.

## Repo layout

```
nova-avatar/
├─ client/   Vite + React + TS (renderer, chat UI, Web Audio)
├─ server/   Express + TS (Anthropic SSE proxy, ElevenLabs proxy)
├─ docs/     deploy notes
├─ render.yaml
├─ CLAUDE.md / WORKFLOW.md
```
