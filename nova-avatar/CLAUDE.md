# Nova — Conversational 3D AI Avatar

## What this is

Web app: a VRM avatar that chats (Anthropic, streamed), speaks (ElevenLabs),
and lip-syncs to real audio amplitude. The client renders; the server proxies
the two external APIs so keys never reach the browser.

Nova lives in this `nova-avatar/` subfolder. The repository root holds a
separate static landing page (`index.html`, `prototype.html`) — leave it alone.

## Stack

- `client/`: Vite + React + TypeScript, three.js + @pixiv/three-vrm, zustand
- `server/`: Node + Express + TypeScript (CommonJS), @anthropic-ai/sdk, zod
- Deploy target: Render (static client site + web-service server)

## Commands (run from `nova-avatar/`)

- `npm run dev` — run client + server together (concurrently)
- `npm run build` — production build (both workspaces)
- `npm run start` — run the built server
- `npm run typecheck` — `tsc --noEmit` for both
- `npm run lint` — eslint
- `npm run format` — prettier --write

## Architecture rules

- API keys live ONLY on the server. Never import or expose them client-side.
- TTS audio is fetched as bytes via `/api/tts` so it can be analysed for lip-sync.
  Do NOT fall back to browser `speechSynthesis` for the spoken reply — it can't
  be tapped by Web Audio, which is the whole reason TTS routes through the server.
- One `AnalyserNode` drives lip-sync; TTS playback and mic input share it.
- Always call `vrm.update(delta)` once per frame in the render loop — it drives
  expressions, lookAt, and spring bones.
- The render loop reads volatile per-frame state (audio level, target emotion)
  from refs/singletons, NOT from React state — never subscribe a component to
  60fps values.

## Conventions

- TypeScript strict; avoid `any`.
- Small, single-purpose hooks/modules in `client/src/avatar` and `client/src/chat`.
- Server is CommonJS (no `"type": "module"`); client is ESM.
- Commit messages: imperative, < 72 chars.

## Build order

Follow `WORKFLOW.md` phases 0→6 (7 optional). Verify each phase's acceptance
criteria before committing.

## Local prerequisites

- Copy `.env.example` to `.env` (repo `nova-avatar/` root) and fill in keys.
- Drop a license-cleared `.vrm` into `client/public/models/` (default path
  `client/public/models/nova.vrm`, override with `VITE_DEFAULT_MODEL_URL`).
  See `client/public/models/README.md`.
- First audio playback needs a user gesture (browser autoplay policy) — the UI
  surfaces an "enable voice" affordance; don't fight it.
