# Customer Voice Calling Agent — POC

A web console for AI-assisted outbound customer calls. The operator starts a
"call" (simulated over browser audio — your mic plays the customer), and the AI
agent conducts a natural voice conversation: speaks first, listens through
server-side VAD, stops the instant it's interrupted, and produces a transcript,
latency report, summary and disposition when the call ends.

```
Browser ──(WebRTC media + "oai-events" data channel)──► OpenAI Realtime API
   │                                                      (STT + LLM + TTS in
   │  /api/session  /api/calls  /api/summarize             one session)
   ▼
Node/Express server ──(mints ephemeral ek_ tokens)──────► /v1/realtime/client_secrets
```

**Why this meets the latency budget:** one model session does STT + reasoning +
TTS with no inter-service hops; audio streams as WebRTC media (no files, no
polling); barge-in truncation is server-side (`interrupt_response: true`). The
chained STT→LLM→TTS pipeline is deliberately *not* used (see "Swapping voice
providers" for when it's viable).

---

## Setup

Requirements: Node 18+ (uses native `fetch`), an OpenAI API key with Realtime
access, Chrome or Edge (best WebRTC + echo-cancellation behavior).

```bash
# 1. Install (root + client)
npm run install:all

# 2. Configure your API key
cp .env.example .env
#    → edit .env and set OPENAI_API_KEY=sk-...

# 3. Run (server on :3001, UI on :5173)
npm run dev
```

Open **http://localhost:5173**, allow microphone access, and click **Start
call**. Use headphones if echo cancellation lets the agent "hear itself."

Production-ish single-process mode:

```bash
npm run build && npm start   # serves the built UI from :3001
```

## API key configuration

All config lives in `.env` (never committed; the browser never sees the real
key — it only ever receives a ~1-minute ephemeral `ek_...` token minted by the
server):

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — | **Required.** Mints ephemeral tokens + generates summaries |
| `REALTIME_MODEL` | `gpt-realtime-2` | Speech-to-speech model |
| `REALTIME_VOICE` | `marin` | Output voice (`marin`, `cedar`, `verse`, …) |
| `SUMMARY_MODEL` | `gpt-4o-mini` | Post-call summary + disposition tagging |
| `VAD_SILENCE_MS` | `400` | Pause length that ends the customer's turn |
| `COMPANY_NAME` | `Northwind Retail` | Injected into the agent persona |
| `VOICE_PROVIDER` | `openai` | Provider key (see below) |

## Latency instrumentation

Open the browser dev console during a call. Every turn logs:

```
[latency] turn 3: speech_end → first_audio = 412ms (running P50 380ms, P90 540ms)
```

- **Measurement window:** `input_audio_buffer.speech_stopped` (server VAD
  declares the customer's turn over) → `output_audio_buffer.started` (first
  agent audio reaches the speaker). That is STT-end → TTS-first-byte plus
  network, i.e. the latency the customer actually perceives.
- The UI's P50 badge refreshes every 5 turns (per spec); the console logs every
  turn, and warns when a turn blows the 800ms budget.
- The full sample set is persisted with the call log in
  `server/data/calls/<id>.json` and shown on the post-call screen (P50/P90).

Note one inherent floor: with `VAD_SILENCE_MS=400`, the model can't *know* the
turn ended until ~400ms of silence has elapsed — that wait happens before the
clock starts. Perceived gap ≈ VAD silence + measured latency. Tune the
trade-off: lower = snappier but more mid-sentence interruptions.

## Scenarios &amp; the refund/returns demo

The dashboard ships with two scenarios (pick via the tabs at the top):

**Refund &amp; Returns (default)** — a physical e-commerce return. The customer
wants a refund on lightly-worn running shoes 34 days after delivery, just past
the 30-day window. The agent reasons against a concrete return policy and a
defined authority boundary:

- *Can resolve alone:* store credit, exchange, partial refund up to 50%, free
  return shipping, fee waivers.
- *Must escalate:* full cash refund outside the window, or >50% on a used item
  — the agent says so honestly and sets up a supervisor callback rather than
  promising an outcome it can't deliver.

**Invoice follow-up** — the original outbound collections scenario.

Both scenarios live in one file, `client/src/lib/scenarios.js`. Each defines the
customer prefill, editable goal, the **policy** and **authority** text injected
into the agent persona, the **dispositions** the post-call summarizer may choose
from, and a set of **customer stances**. Editing or adding a scenario is a pure
data change in that one file.

### Customer stances (you play the customer)

Because the POC simulates the call over your browser mic, *you* are the
customer. Each scenario offers stances you pick per call — these are role-play
cues shown to you during the call (left rail), e.g. for refunds: *reasonable*,
*frustrated / threatening to leave*, *outside-window exception*, and *defective
item*. The agent is **not** told which stance you chose; it handles whatever you
bring in real time. The defective-item stance is a good one to test policy
reasoning — a genuine defect should get a full refund regardless of the window,
and a well-behaved agent won't try to push store credit or escalate it.

Policy and authority are visible on the dashboard under "Policy &amp; authority
the agent will reason against" — expand it before a call so you know where the
negotiation boundaries are.## Agent behaviour

The persona (in `server/persona.js`) is injected as session `instructions` at
token-mint time, with the per-call goal, customer context, **policy** and
**authority** templated in. It enforces: ≤30-word turns, one question at a time,
lead-with-empathy de-escalation, "here's what I can do" framing, one concrete
offer at a time, honest escalation (never promising an approval it doesn't
have), immediate yield on interruption, and an honest answer if asked whether
it's an AI. Dead air >5s triggers a client-side "Are you still there?" nudge
(`client/src/lib/realtime.js`, `SILENCE_PROMPT_MS`).

Barge-in: server VAD truncates output audio automatically
(`interrupt_response: true`); the client also sends a defensive
`response.cancel` and logs `[barge-in]` to the console.

## Swapping voice providers

The seams are deliberate:

1. **Server** — `server/providers.js` exposes `createSession()` per provider,
   normalized to `{ provider, token, baseUrl, model }`. Set
   `VOICE_PROVIDER=<key>` in `.env` to switch.
2. **Client** — `client/src/lib/realtime.js` is the OpenAI WebRTC transport. A
   new provider with a different wire protocol gets its own transport module
   implementing the same handler interface (`onCustomerFinal`,
   `onAgentAudioStart`, …); `App.jsx` doesn't change.

**ElevenLabs (voice quality priority):** ElevenLabs Agents is the closest
like-for-like — its SDK manages the WebRTC/WS session, so the transport swap is
small: mint a conversation token server-side, use their client SDK events to
feed the same handlers. Use a Flash/Turbo-class voice for TTFA, v3-class for
maximum expressiveness (at a latency cost — measure before choosing).

**AssemblyAI + Cartesia/ElevenLabs (chained, maximum control):** viable only if
stage latencies sum <500ms: streaming STT with fast endpointing (~300ms) →
streaming LLM tokens → streaming TTS flushed sentence-by-sentence (~90ms TTFA
class). You own turn-taking, barge-in and audio plumbing yourself — budget real
engineering time. A stub with the recipe is in `server/providers.js`.

## Project layout

```
server/
  index.js        Express: /api/session, /api/calls, /api/summarize
  persona.js      Agent system prompt builder
  providers.js    Voice-provider abstraction (openai implemented)
  data/calls/     Persisted call logs (JSON per call)
client/src/
  App.jsx         Idle / In-call / Post-call state machine
  lib/realtime.js WebRTC transport, event routing, barge-in, silence watchdog
  lib/latency.js  Per-turn latency tracker (P50/P90, console logging)
  components/     CallSetup, CallConsole, Transcript, MicMeter, PostCall
```

## Known POC limitations

- No PSTN dialing — the "customer" is whoever talks into the browser mic. (To
  go real: SIP/Twilio media streams into a server-side WebSocket Realtime
  session instead of browser WebRTC.)
- Single user, no auth, no CRM — out of scope per spec.
- Call logs are flat JSON files; fine for a POC, not for volume.
- If `OPENAI_API_KEY` is missing, calls fail with a clear banner; the post-call
  summary degrades to a heuristic fallback.
