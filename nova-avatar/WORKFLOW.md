# Build Workflow — "Nova": Conversational 3D AI Avatar

A phased, hand-to-Claude-Code workflow for turning the single-file prototype
into a production-grade web app: a VRM avatar that converses (LLM), speaks
(TTS), and lip-syncs to real audio amplitude, with blinking, idle motion, gaze
tracking, and emotion.

Built for the stack: React + Node/Express + Render, with TypeScript for safety.

## 1. Product spec

- **MVP (Phases 0–3):** open the app → a VRM avatar is on screen, idling and
  blinking → you type → it replies (streamed) → it speaks the reply with TTS
  while its mouth lip-syncs to the audio amplitude.
- **Full (Phases 4–6):** emotion-reactive expressions, model switching, polished
  UX, hardened + deployed.
- **Stretch (Phase 7):** viseme-accurate lip-sync, `.vrma` idle/gesture
  animations, chat persistence, streaming TTS.
- **Non-goals:** photorealistic humans, mobile-native app, multi-user rooms.

## 2. Architecture & rationale

A thin client does all rendering; a thin server proxies the two external APIs.
The server is not optional — it exists for two concrete reasons:

1. **Key security** — the Anthropic and ElevenLabs keys never reach the browser.
2. **Analyzable audio** — browser `speechSynthesis` output can't be tapped by
   Web Audio. Routing real TTS audio bytes back to the client lets an
   `AnalyserNode` read true amplitude → accurate visemes. This is the whole
   reason TTS goes through the backend.

```
Client · Vite + React + TS                Server · Node + Express + TS
  Chat UI → state (zustand) → three-vrm      POST /api/chat — SSE stream
  Web Audio AnalyserNode → three-vrm         POST /api/tts — audio bytes
  UI --user message--> /api/chat --streamed tokens--> UI
  UI --reply text--> /api/tts --audio buffer--> AnalyserNode
  /api/chat -> Anthropic Messages API
  /api/tts  -> ElevenLabs TTS
```

Choices: Vite + React + TypeScript, `three` + `@pixiv/three-vrm`, `zustand` for
state, `@anthropic-ai/sdk` server-side with streaming, `zod` for env validation,
`concurrently` to run both dev servers.

## 3. Repo structure (target)

```
nova-avatar/
├─ CLAUDE.md
├─ WORKFLOW.md
├─ package.json                # root: concurrently dev script
├─ .env.example
├─ client/
│  ├─ index.html
│  ├─ vite.config.ts           # proxy /api → server in dev
│  ├─ public/models/           # license-cleared sample .vrm
│  └─ src/
│     ├─ main.tsx
│     ├─ App.tsx
│     ├─ avatar/
│     │  ├─ Avatar.tsx          # mounts canvas, owns three scene + loop
│     │  ├─ useVRM.ts           # load / frame / dispose a VRM
│     │  ├─ useLipSync.ts       # AnalyserNode → mouth level
│     │  └─ expressions.ts      # emotion → VRM expression mapping
│     ├─ chat/
│     │  ├─ ChatPanel.tsx
│     │  ├─ useChat.ts          # SSE stream client
│     │  └─ useSpeech.ts        # fetch /api/tts → play + analyse
│     └─ state/store.ts         # zustand store
└─ server/
   ├─ src/
   │  ├─ index.ts               # express app
   │  ├─ routes/chat.ts         # Anthropic streaming proxy (SSE)
   │  ├─ routes/tts.ts          # ElevenLabs proxy (returns audio)
   │  └─ env.ts                 # zod-validated config
   └─ tsconfig.json
```

## 4. Prerequisites & environment

- Node 18+, npm.
- A license-cleared `.vrm` (your own VRoid Studio export is safest).
- `.env` (root), with `.env.example` committed:

```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
PORT=8787
CLIENT_ORIGIN=http://localhost:5173
```

## 5. Phased build plan

### Phase 0 — Scaffold & tooling
- **Goal:** runnable monorepo, both dev servers boot, no app logic yet.
- **Acceptance:** `npm run dev` starts both; `GET /api/health` returns
  `{ok:true}`; client renders a blank styled page.

### Phase 1 — VRM viewer core
- **Goal:** a VRM renders and feels alive.
- **Deliverables:** `Avatar.tsx` owning the three.js scene (renderer, camera,
  lights, `OrbitControls`, resize via `ResizeObserver`); `useVRM.ts` to load a
  `.vrm` (and via drag-and-drop / file input) using `GLTFLoader` +
  `VRMLoaderPlugin`; animation loop with `vrm.update(dt)`, gentle idle bob/sway,
  periodic blink, and gaze tracking (`vrm.lookAt.target = camera`). Call
  `VRMUtils.rotateVRM0(vrm)`. Dispose previous VRM on swap (`VRMUtils.deepDispose`).
- **Acceptance:** sample model loads, blinks, idles, eyes follow the orbit
  camera; dragging another `.vrm` swaps it without leaks.

### Phase 2 — Chat backend + UI (streaming)
- **Goal:** real, streamed conversation.
- **Deliverables:** `POST /api/chat` takes `{messages}`, calls Anthropic via
  `@anthropic-ai/sdk` with streaming, relays tokens as SSE; a system prompt
  giving Nova a concise, spoken-aloud persona. Client `useChat.ts` consumes the
  SSE stream; `ChatPanel.tsx` renders streamed messages with a typing indicator.
- **Notes:** cap history (last ~12 turns) server-side; handle abort/errors.
- **Acceptance:** typing a message streams a reply token-by-token; context
  persists across turns.

### Phase 3 — TTS + amplitude lip-sync (keystone)
- **Goal:** Nova speaks the reply and the mouth tracks the actual audio.
- **Deliverables:** `POST /api/tts` takes `{text}`, calls ElevenLabs, streams
  back audio bytes. Client `useSpeech.ts` — fetch audio →
  `AudioContext.decodeAudioData` → play via `AudioBufferSourceNode` → route
  through an `AnalyserNode`. `useLipSync.ts` — each frame compute RMS, smooth it,
  set the VRM `aa` expression (small `ih`/`ou` for variation).
- **Notes:** this `AnalyserNode` is the single lip-sync engine — mic mode feeds
  the same code path. Add a voice on/off toggle. First audio needs a user gesture.
- **Acceptance:** after a reply, audio plays and the mouth opens/closes in time
  with amplitude; muting stops both audio and mouth.

### Phase 4 — Emotion / expression engine
- **Goal:** Nova reacts, not just talks.
- **Deliverables:** `expressions.ts` mapping an emotion label → VRM expressions
  (`happy`, `sad`, `angry`, `surprised`, `relaxed`); smooth blending each frame.
  Get the label cheaply: instruct the model to prefix replies with a hidden tag
  (`[[emotion:happy]]`) that the server strips and returns as metadata. Apply on
  reply, decay to neutral after speaking.
- **Acceptance:** a cheerful reply makes Nova smile; a somber one softens the
  face; transitions are smooth.

### Phase 5 — Model management + UX polish
- **Goal:** product-grade feel.
- **Deliverables:** model switcher (drag-drop, file picker, and direct-URL
  load), loading/empty/error states, mic-lip-sync toggle reusing the analyser,
  responsive layout, and the holo-lab aesthetic (deep indigo, glowing accents,
  glass chat panel, distinctive type). Keyboard a11y and reduced-motion support.
- **Acceptance:** models swap cleanly with clear feedback; layout holds from
  mobile to desktop; looks intentional, not generic.

### Phase 6 — Hardening & deploy (Render)
- **Goal:** safe to ship.
- **Deliverables:** server input validation (`zod`), rate limiting on
  `/api/chat` and `/api/tts`, strict CORS to `CLIENT_ORIGIN`, request size
  limits, env-var startup validation, production build. Deploy: client as a
  static site + server as a Render web service. Basic GitHub Actions CI
  (typecheck + build).
- **Acceptance:** prod build runs; rate limits and CORS enforced; deployed
  client talks to deployed server.

### Phase 7 — Stretch (optional)
- Viseme-accurate lip-sync (phonemes / Oculus visemes → `aa/ih/ou/ee/oh`).
- `.vrma` VRM Animation clips for idle/gesture variety.
- Chat persistence in MongoDB.
- Streaming TTS (synthesize + play in chunks) to cut time-to-first-audio.
- WebGPU renderer path.

## 6. Key implementation notes (the hard parts)

- **VRM:** register `VRMLoaderPlugin` on `GLTFLoader`; after load grab
  `gltf.userData.vrm`, call `VRMUtils.rotateVRM0`, set `vrm.lookAt.target`, and
  call `vrm.update(delta)` every frame. Dispose with `VRMUtils.deepDispose` on swap.
- **Lip-sync engine:** one `AnalyserNode`; `getByteTimeDomainData` → RMS →
  smoothed `mouthLevel` → `expressionManager.setValue('aa', level)`. Both
  TTS-audio and mic feed the same node — never re-implement per source.
- **Streaming chat:** server emits SSE text deltas; client appends as they
  arrive. Keep the key server-side only.
- **Emotion:** prefer a model-emitted tag the server strips over a separate
  sentiment call (one round trip, near-free).
- **Security:** no API keys, prompts, or model names exposed to the client;
  validate and rate-limit every route.

## 7. Definition of done

- **MVP shippable:** Phases 0–3 (+ light Phase 5 polish).
- **v1:** Phases 0–6 — emotion, model switching, hardened, deployed on Render.
- Cut Phase 7 unless specifically needed.

## 8. Lessons baked in (from the prototype)

- Browser `speechSynthesis` can't be analysed → that's why TTS routes through
  the server. Don't revert to client-side speech for the spoken reply.
- Bundling (Vite) removes importmap/CDN-sandbox fragility.
- Respect VRM licenses; a VRoid export is the zero-restriction option.
- First audio requires a user gesture — surface that in the UI.
