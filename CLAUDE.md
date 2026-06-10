# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (root + client)
npm run install:all

# Development (server :3001, client :5173, concurrently)
npm run dev

# Individual processes
npm run dev:server   # Node/Express only
npm run dev:client   # Vite only

# Production build + serve (single process on :3001)
npm run build && npm start
```

No test runner or linter is configured.

## Environment

Copy `.env.example` to `.env`. The only required variable is `OPENAI_API_KEY`. The browser never sees this key — the server uses it only to mint short-lived ephemeral `ek_...` tokens and to call the summary endpoint.

Key optional overrides: `REALTIME_MODEL`, `REALTIME_VOICE`, `VAD_SILENCE_MS`, `COMPANY_NAME`, `VOICE_PROVIDER`.

## Architecture

Two processes that share no code at runtime:

```
client/ (Vite + React, :5173)
  Vite proxies /api → :3001

server/ (Node/Express, :3001)
  Mints ephemeral tokens; persists call logs; generates summaries
```

**The critical path for a call:**

1. `App.jsx` calls `RealtimeSession.start()` (`client/src/lib/realtime.js`).
2. `realtime.js` POSTs to `/api/session` → server mints an ephemeral token via `providers.js` → persona from `server/persona.js` is baked in at token-mint time.
3. Browser opens a WebRTC `RTCPeerConnection` with mic track up and agent audio track down; a `"oai-events"` data channel carries JSON events (transcripts, VAD, audio buffer lifecycle).
4. Browser POSTs its SDP offer directly to the OpenAI Realtime API using the ephemeral token. The server is **not** in the media path after this point.
5. On call end, `App.jsx` POSTs to `/api/calls` (persist) and `/api/summarize` (AI summary + disposition).

## Key design decisions

**Barge-in** is handled server-side via `interrupt_response: true` in the session config. The client also sends a defensive `response.cancel` and calls `tracker.cancelPending()` to discard the in-flight latency sample.

**Latency measurement** (`client/src/lib/latency.js`): `speech_stopped` event → `output_audio_buffer.started` event. The displayed P50 badge updates every 5 turns. Samples > 800ms print a console warning. Full sample set is saved in the call log JSON.

**Dead-air handling** (`realtime.js`, `SILENCE_PROMPT_MS = 5000`): if the agent finishes speaking and the customer is silent for 5 seconds, the client injects a `response.create` with a "are you still there?" instruction.

## Extending scenarios

All scenario data lives in `client/src/lib/scenarios.js` — customer prefill, goal, policy, authority, dispositions, and per-call customer stances. Adding or editing a scenario is a pure data change in that one file. The `policy` and `authority` strings are injected verbatim into `server/persona.js`'s prompt template.

## Adding a voice provider

1. **Server** (`server/providers.js`): implement `createSession()` returning `{ provider, token, baseUrl, model, expiresAt }`. Add it to the `providers` map. Set `VOICE_PROVIDER=<key>` in `.env`.
2. **Client** (`client/src/lib/`): write a new transport class implementing the same handler interface as `RealtimeSession` (`onCustomerFinal`, `onAgentAudioStart`, `onBargeIn`, etc.) and wire it in `App.jsx`.

The `assemblyai` entry in `providers.js` is a documented stub with the chained STT→LLM→TTS recipe.

## Call log storage

Persisted as flat JSON files in `server/data/calls/<id>.json`. Files are created on `POST /api/calls` and read on `GET /api/calls/:id`. The directory is auto-created on server startup.
