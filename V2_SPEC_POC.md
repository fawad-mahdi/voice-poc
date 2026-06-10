# V2 — Auth-Machine AI Sales Automation POC (Trimmed Scope)
### Multi-Brand Voice Sales Agent — built on the V1 Customer Voice Calling Agent

> **Audience:** Claude Code. This is a build spec. V1 exists in this repo and works — read
> `README.md` and `CLAUDE.md` first. V2 is an extension, not a rewrite. Every V1 capability
> (WebRTC Realtime calls, ephemeral token minting, server VAD, barge-in, latency
> instrumentation, silence nudge, post-call summarize) must keep working and is reused as
> the call engine underneath everything below.
>
> **This document supersedes any earlier, larger V2 spec.** Scope was deliberately cut to
> the seven highest-impact features. Appendix A lists what was deferred to Stage 2 — do
> NOT build Appendix A items, but design seams so they slot in later (noted inline where
> it matters).

---

## 1. Context

**V1** is a single-scenario voice-call console: one persona, one company, transcript +
latency report + summary + disposition at call end.

**V2** demonstrates a **multi-brand AI sales platform** for a UAE real estate group. The
client's previous vendor failed in exactly two ways, and this POC exists to visibly
disprove both:

1. **The bot blended brand identities.** → V2's answer: structural per-brand isolation.
2. **The bot couldn't answer basic off-plan property questions.** → V2's answer: a real
   per-brand knowledge base the agent reasons against.

The three entities:

| Entity | What it is | Persona required |
|---|---|---|
| **H&S Real Estate** | Haqsons Group subsidiary (est. 2006). Premium off-plan brokerage; official sales agent for Emaar, DP, DAMAC, Nshama. UAE + international HNW clients. | High-trust, relationship-driven, premium, institutional. "White glove." Never transactional. |
| **Deca Properties** | Dubai boutique developer selling its own projects developer-direct (JVC, Meydan, Al Marjan Island, Al Zorah, DLRC, Dubai Science Park, IMPZ). Plans from 10% down. | Developer-direct, investment-focused, data-confident, modern. ROI and risk-minimisation language. Works for seasoned investors *and* first-time buyers. |
| **DPS — Dubai Property Exhibition** | Opened 25 Mar 2026, Al Barsha 2. First permanent real-estate exhibition in the region; 365 days/yr, free entry, 30+ developers, 400+ developments. | Neutral, platform-oriented, welcoming. **Sells a visit to the exhibition, never a specific property.** Calibrates to agents / buyers / investors. |

**Demo conceit (unchanged from V1):** no telephony — the operator plays the customer over
the browser mic. Everything else is real.

## 2. POC scope — the seven features

| # | Feature | One-liner |
|---|---|---|
| F1 | Brand registry + persona builders | Three fully isolated brand configs; persona compiled server-side at token-mint from one brand only |
| F2 | Per-brand knowledge base | Curated off-plan project data injected into instructions; "stay in your lane" rule |
| F3 | Brand-themed SaaS shell | CommandView + workspaces; entering a workspace re-themes the whole UI |
| F4 | Bilingual / Arabic code-switching | Per-call language mode (Auto/EN/AR); agent mirrors the customer mid-call |
| F5 | Live qualification checklist + objection tracker | Slots fill in live during the call from async LLM extraction |
| F6 | Handover packet | Closer-facing context view: brief, qualification, commitments, "don't re-ask" guidance |
| F7 | QA scorecard (lite) | One post-call scorecard against a per-brand rubric; hard-flag compliance failures |

Plus one piece of demo dressing: a **static routing card** on the post-call screen (NOT a
rules engine — see F6/§7.6).

**Non-goals for this POC:** everything in Appendix A, plus (carried from V1): PSTN/Twilio,
auth, real CRM, vector DBs, Arabic console UI (the *agent* speaks Arabic; the console stays
English), production data stores. Flat JSON remains fine.

**Quality bar:** not production-grade, but the UI must read as a **modern SaaS product** —
Linear/Attio/Intercom-grade polish. Use the `frontend-design` skill for the shell. Dark,
confident, dense-but-calm.

## 3. The demo narrative (build toward this — 8 beats)

1. Open the app → **CommandView**: three brand workspace cards, each visibly its own
   product (typographic logo block, accent colour, persona descriptor).
2. Enter **Deca** → pick a seeded lead → **Pre-call screen**: lead dossier, language mode,
   operator stance picker, policy/authority card, "Isolated context" chip.
3. **Live call**: agent opens rapport-first; operator asks about Marjan Bay payment plans
   and JVC yield comparison → agent answers specifically from the KB. The **qualification
   checklist fills itself in** on the right rail; latency badge keeps ticking (V1).
4. Operator switches to Arabic mid-call → agent follows without comment.
5. Operator pushes for a discount past authority → agent escalates honestly (persona
   behavior — no banner machinery needed).
6. Call ends → **post-call**: V1 summary/disposition/latency + **QA scorecard** +
   **qualification result** + static **routing card**.
7. Click **"Open handover packet"** → the closer-facing screen.
8. Switch to **H&S** → total re-theme; ask the H&S agent about Marjan Bay (a Deca
   project) → it politely doesn't carry it and pivots to its own inventory. Then **DPS**
   → the agent pitches a visit, quotes no unit prices.

## 4. Architecture

```
            UNCHANGED (V1 core)                      NEW IN V2 (POC scope)
┌──────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ Browser WebRTC ↔ OpenAI Realtime API │   │ F1 Brand registry + persona builder │
│ /api/session ephemeral token minting │   │ F2 Knowledge base injection         │
│ Server VAD, barge-in, silence nudge  │   │ F3 SaaS shell + per-brand theming   │
│ latency.js P50/P90 instrumentation   │   │ F4 Language modes (prompt-level)    │
│ Call-log persistence (JSON files)    │   │ F5 Live qualification extraction    │
│ /api/summarize                       │   │ F6 Handover packet (+static route)  │
└──────────────────────────────────────┘   │ F7 QA scorer (single rubric call)   │
                                           └─────────────────────────────────────┘
```

**Structural rule (the whole point):** the client sends a `brandId`; the server resolves
persona, knowledge, policy, authority and dispositions from that brand's config **only**
and bakes them into the ephemeral token's `instructions` at mint time (V1 pattern). No
brand's data is ever present in another brand's session. Comment this in code; surface it
in the UI as an "Isolated context" chip with a tooltip.

### 4.1 Server layout (additions)

```
server/
  index.js            extend with new routes (§8)
  persona.js          → buildPersona(brand, lead, callConfig) (§6)
  providers.js        unchanged
  brands/
    index.js          registry loading the three configs
    hs.js  deca.js  dps.js
  knowledge/
    hs.projects.json  deca.projects.json  dps.exhibition.json
  qa/
    rubrics.js        per-brand rubric (placeholder for client's 200-pt checklist)
    scorer.js         one SUMMARY_MODEL call: transcript+rubric → scorecard JSON
  leads/
    seed.json         ~9 leads (3 per brand); read-only for the POC (no status lifecycle)
  handover.js         assembles packet from call log + qualification + summary
```

### 4.2 Client layout (additions)

```
client/src/
  App.jsx                  → router/shell (workspace switcher + pages)
  theme/brandThemes.js     per-brand design tokens
  pages/
    CommandView.jsx        three-workspace landing
    Workspace.jsx          brand layout (nav: Leads · Call)
    LeadQueue.jsx          seeded lead list + dossier drawer → Start call
    PreCall.jsx            dossier + persona card + language mode + stance picker
    LiveCall.jsx           V1 CallConsole + qualification right rail
    PostCall.jsx           V1 PostCall + QA scorecard + qualification + routing card
    HandoverPacket.jsx     closer-facing packet
  lib/
    realtime.js            unchanged transport; start() takes {brandId, leadId, languageMode}
    latency.js             unchanged
    scenarios.js           retired (brand configs replace it); delete unless trivially
                           kept as a "Legacy demo" entry
```

## 5. Data model (flat JSON)

### 5.1 Brand config (server/brands/*.js)

```js
{
  id: "deca",
  name: "Deca Properties",
  theme: { accent: "#04D9B2", surface: "dark", toneWords: ["modern","data-confident"] },
  persona: {
    identity: "...brand-voice identity text...",
    style: "...rapport-first + V1 discipline (≤30-word turns, one question at a time)...",
    culture: "...Middle-East rapport-first guidance: trust before pitch, no hard sell...",
    aiDisclosure: true                       // V1 honest-AI rule, always
  },
  policy: "...what the agent may claim/offer...",
  authority: {
    canDoAlone: ["share payment plans","book viewing/visit","send brochure","register interest"],
    mustEscalate: ["price negotiation beyond published plans","legal/contract questions",
                   "unit reservations","complaints"]
  },
  dispositions: ["qualified-hot","qualified-warm","nurture","not-interested",
                 "escalated-to-closer","callback-scheduled"],   // DPS adds "visit-booked"
  knowledgeFile: "knowledge/deca.projects.json",
  rubricId: "deca-v1",
  routingCard: {            // STATIC demo dressing, not an engine (Stage 2 = real rules)
    hot:  { name: "Sara Al-Mansoori", role: "Senior Investment Consultant",
            reason: "Investor profile · budget ≥ AED 2M · Al Marjan interest" },
    warm: { name: "Bilal Rahman", role: "Investment Consultant",
            reason: "Warm lead · follow-up cadence" },
    cold: { name: "Nurture pool", role: "Marketing automation",
            reason: "Low intent · re-engage in 30 days" }
  }
}
```

DPS's `routingCard.hot/warm` point to a **visit slot** ("Thu 7pm visit · VIP desk")
instead of a salesperson.

### 5.2 Knowledge entries (server/knowledge/*.json)

H&S and Deca: 6–8 projects each, realistic but fictionalised (plausible names/areas,
invented prices, `"disclaimer": "demo data"`):

```json
{
  "projectId": "deca-marjan-bay",
  "name": "Marjan Bay Residences",
  "location": "Al Marjan Island, RAK",
  "developer": "Deca Properties",
  "developerTrackRecord": "4 delivered projects, avg. 2 months early handover",
  "type": "1–3BR smart-home apartments",
  "priceFromAED": 1450000,
  "paymentPlan": "10% down / 50% during construction / 40% on handover",
  "handover": "Q4 2027",
  "roiNotes": "Area short-term rental yields ~9–11% gross (demo figure)",
  "comparisons": ["vs JVC: higher yield, longer commute to DXB"],
  "sellingPoints": ["beachfront", "post-handover plan available"],
  "faqs": [{ "q": "Is there a post-handover payment plan?", "a": "..." }]
}
```

DPS's file is different in kind: exhibition facts (Al Barsha 2, 10am–10pm, 365 days, free
entry, 30+ developers incl. DAMAC, Sobha, Binghatti, Danube, Ellington, Deca; 400+
developments), what each audience type (agent/buyer/investor) gets from a visit, and a few
visit slots. **The DPS agent must not quote unit prices** — when asked, it pivots to
"every developer is on the floor; compare them in one visit."

**Injection (RAG-lite):** serialise the brand's whole KB into a compact `<knowledge>`
block in the instructions at mint time — these KBs are small; do NOT build retrieval. Add:
*"Answer product questions only from <knowledge>. If asked about anything outside it —
including other companies' projects — say you don't carry that information and offer what
you do have."*

### 5.3 Lead (server/leads/seed.json — 3 per brand, read-only)

```json
{
  "id": "lead-007",
  "brandId": "deca",
  "name": "Omar Khalid",
  "phone": "+971 5x xxx xx07",
  "type": "warm",
  "source": "Property Finder enquiry — Marjan Bay",
  "profile": "Repeat investor, owns 2 units in JVC",
  "languagePref": "ar",
  "budgetHintAED": 2000000
}
```

### 5.4 Qualification result (live partials + final)

```json
{
  "intent": "investment | end-use | browsing | unknown",
  "budgetAED": 2000000,
  "timeline": "0-3m | 3-6m | 6m+ | unknown",
  "locationInterest": ["Al Marjan Island"],
  "paymentPlanFit": true,
  "objections": [{ "objection": "RAK resale liquidity", "handled": true }],
  "temperature": "hot | warm | cold",
  "facts": ["owns 2 JVC units", "prefers Arabic", "wants post-handover plan"]
}
```

## 6. F1+F4 — Persona builder (server/persona.js rework)

`buildPersona(brand, lead, callConfig)` → instructions string. Composition order, clearly
delimited sections:

1. **Identity** — brand voice (see notes below). Includes V1's honest-AI rule verbatim.
2. **Cultural calibration** — warm unhurried greeting; ask permission for a few minutes;
   acknowledge the lead's context from the dossier; build rapport **before** any pitch;
   never pressure; respect formality/titles; end with a clear low-pressure next step.
3. **Language** (F4) — per `callConfig.languageMode`:
   - `en`: speak English; follow the customer if they switch to Arabic.
   - `ar`: open in Gulf Arabic; mirror thereafter.
   - `auto` (default): open in the lead's `languagePref`; **always mirror the customer's
     current language, switching mid-call without comment.**
4. **Call goal** — cold lead: introduce + qualify + book next step; warm lead: reference
   the enquiry, deepen, qualify, advance.
5. **Knowledge block** — §5.2 injection + stay-in-lane rule.
6. **Policy & authority** — V1 templating. Escalation must be honest and warm: "That's
   exactly what my senior colleague handles — let me set that up properly." Never fake
   approvals.
7. **Conversation discipline** — V1 rules survive verbatim: ≤30-word turns, one question
   at a time, lead-with-empathy, one concrete offer at a time, yield on interruption.
8. **Qualification duty** — "Across the conversation, naturally learn: intent, budget,
   timeline, location interest, payment-plan fit. Weave it in; never interrogate."

### Per-brand identity notes (write these out fully in the configs)

- **H&S**: senior consultant at H&S Real Estate, Haqsons Group, 25+ years in the UAE,
  official mandates from Emaar, DAMAC, DP, Nshama. Measured, gracious, institutional
  warmth. Sells trust and access, never urgency. HNW-appropriate vocabulary.
- **Deca**: investment consultant at Deca Properties — developer-direct, no broker layer,
  plans from 10% down. Sharp, modern, numerate; leads with yields, payment-plan math,
  delivery track record. Explains off-plan mechanics simply for first-time buyers.
- **DPS**: visitor-experience ambassador for the Dubai Property Exhibition — region's
  first permanent property exhibition, 365 days, free entry, 30+ developers, 400+
  projects, Al Barsha. Goal is **always a visit**. Neutral among developers; never
  recommends one project over another; calibrates pitch to agent vs buyer vs investor.

## 7. Feature specs

### 7.1 F3 — SaaS shell & theming

- `CommandView` (`/`): three workspace cards — typographic brand mark, accent, one-line
  persona descriptor, lead count. Click → workspace.
- `Workspace` (`/w/:brandId`): left rail nav, just **Leads · Call** for this POC. The
  entire workspace re-themes instantly and totally from `brandThemes.js` (accent,
  gradients, charts). Suggested accents (tune with frontend-design skill): H&S deep
  navy + gold; Deca teal/mint on near-black; DPS warm coral/amber. Shared dark neutral
  base so it still feels like one platform.
- Slim top bar: brand badge + **"Isolated context"** chip (tooltip: "This agent's prompt,
  knowledge and rules are compiled exclusively from this workspace at call start. No
  cross-brand data enters the session.").

### 7.2 F2 dressing — Lead queue & Pre-call

- `LeadQueue`: simple table of the brand's 3 seeded leads (name, type, source, language).
  Row → dossier drawer → **Start call**. No status lifecycle (Stage 2).
- `PreCall`: dossier; editable goal (V1); collapsible Policy & Authority card (V1);
  **language mode** segmented control (Auto / English / Arabic); **operator stance
  picker** — role-play cues shown only to the operator in the left rail during the call
  (V1 pattern):
  - *Interested investor* (asks ROI / payment-plan / comparison questions)
  - *Skeptical — burned before* (delays, developer-trust objections)
  - *Price objector* (pushes past authority → forces the honest-escalation beat)
  - *Arabic speaker* (open in Arabic or switch mid-call)
  - *Asks if you're an AI* (compliance beat)
  - DPS extra: *Real-estate agent calling* (audience-calibrated pitch test)

### 7.3 F5 — Live call console (extend V1 CallConsole)

Keep all of V1: transcript, mic meter, latency badge (P50 every 5 turns, 800ms warnings),
barge-in, silence nudge, end call.

Add a right rail:
- **Qualification checklist** — five slots (Intent / Budget / Timeline / Location /
  Payment-plan fit) that fill in live. Implementation: every 3rd customer-final
  transcript, POST the rolling transcript to `POST /api/qualify/live` → fast
  `SUMMARY_MODEL` JSON extraction (§5.4 shape, partial fields allowed). Async,
  non-blocking, never on the audio path; debounce so at most one request is in flight.
- **Objection chips** — from the same extraction response (objection + handled ✓/✗).
- No escalation banner (Stage 2) — the escalation *behavior* still happens via persona.

### 7.4 F7 — QA scorecard (lite)

- `server/qa/rubrics.js`: one rubric per brand, **explicitly commented as placeholder
  pending the client's 200-point checklist** — an array of criteria objects so swapping
  is trivial:

| Criterion | Checks | Type |
|---|---|---|
| AI disclosure | If asked, answered honestly | pass/fail (hard flag) |
| No false promises | Nothing beyond `authority` | pass/fail (hard flag) |
| Brand isolation | Never referenced another entity's inventory/identity | pass/fail (hard flag) |
| Rapport before pitch | Trust-building preceded product push | 0–10 |
| Product accuracy | Claims match the injected KB | 0–10 |
| Objection handling | Acknowledge → address → advance | 0–10 |
| Qualification coverage | How many of the 5 slots learned naturally | 0–10 |
| Next-step clarity | Ended with a concrete agreed next step | 0–10 |

- `server/qa/scorer.js`: one `SUMMARY_MODEL` call — input: transcript + brand persona
  summary + KB + rubric; output strict JSON
  `{ total: 0-100, criteria: [{id, score, max, evidence}], flags: [{criterionId, evidence}] }`.
  Hard-flag fail OR total < 70 ⇒ `flagged: true`. Persist into the call log JSON.
- Rendered on PostCall as a score ring + per-criterion bars + flags list. No QA Review
  queue page (Stage 2).

### 7.5 Final qualification

On call end, `POST /api/qualify` runs the full-transcript extraction (final, complete
§5.4) with `SUMMARY_MODEL`; persists into the call log.

### 7.6 F6 — Post-call + static routing card + handover packet

`PostCall` keeps V1 (transcript, summary, disposition, latency P50/P90) and adds:
1. **QA scorecard** (§7.4).
2. **Qualification result** (§5.4) — facts as a dossier addendum; temperature pill.
3. **Routing card (STATIC)** — pick `brand.routingCard[temperature]` and render assignee
   name/role/reason (or DPS visit slot). It must *look* like a routing decision; the real
   rules engine is Stage 2 and the seam is exactly this card's data source.
4. Primary button → **Handover packet**.

`server/handover.js` + `HandoverPacket.jsx`:
- Header: lead identity + temperature + assignee (from the routing card) + "AI call ·
  {date} · {duration}".
- **"Read this first"** — 3-bullet brief: who they are, what they want, what was
  promised/agreed. Generate it in the summarize step: extend `/api/summarize`'s output to
  `{ summary, disposition, brief3: [..], commitments: [..] }` (one extra instruction in
  the existing prompt — no new model call).
- Qualification dossier incl. objections (+handled).
- **Commitments made by the agent** — the no-dropped-context guarantee, explicit.
- "Don't re-ask: budget, timeline, location — captured above."
- Full transcript, collapsed. QA score chip.
- Decorative **"Send to {assignee} via CRM"** button (toast only; no persistence needed).

## 8. API surface (additions to server/index.js)

```
GET  /api/brands              → registry (id, name, theme, persona summary, lead count)
GET  /api/brands/:id          → config for UI (policy, authority, dispositions, routingCard,
                                 project name list for the dossier — NOT the full KB)
GET  /api/leads?brandId=      → seeded leads
POST /api/session             → V1, body now { brandId, leadId, languageMode, goalOverride? }
                                 ← persona compiled here, brand-isolated
POST /api/qualify/live        → { brandId, transcript[] } → partial qualification JSON
POST /api/qualify             → final qualification; persisted to call log
POST /api/summarize           → V1, output extended with { brief3, commitments }
POST /api/qa/score            → { callId } → scorecard; persisted; sets flagged
GET  /api/calls/:id           → V1
GET  /api/handover/:callId    → assembled packet
```

Call-end orchestration (client-driven, V1 style): persist → summarize → qualify →
qa/score, with each PostCall panel rendering as its result lands (skeleton loaders, not a
blocking spinner).

## 9. Acceptance criteria

1. `npm run dev` with only `OPENAI_API_KEY` boots the full V2 experience with all seed
   data.
2. On a Deca call, "what's the payment plan on Marjan Bay and how does the yield compare
   to JVC?" gets a specific, KB-accurate spoken answer.
3. Asking the **H&S** agent about Marjan Bay → it states it doesn't carry that project
   and pivots to its own inventory; the QA brand-isolation criterion passes. (If it had
   cross-sold, the scorer hard-flags.)
4. Language mode Auto + Arabic-opening customer → call conducted in Arabic; switching to
   English mid-call, the agent follows.
5. The price-objector stance produces an honest escalation (no fake approval) and the
   disposition lands on `escalated-to-closer`.
6. The qualification checklist visibly fills during a call without any audible latency
   impact (extraction is async; latency badge stays in budget).
7. PostCall shows scorecard + qualification + routing card; the handover packet contains
   the 3-bullet brief, qualification, commitments, and "don't re-ask" guidance.
8. DPS agent never quotes a unit price and always drives toward a visit.
9. All V1 behaviours still pass: barge-in, latency P50/P90 logging, silence nudge,
   graceful degradation without the API key (QA/qualification panels show "unavailable"
   states, no crashes).
10. Every page reads as a designed SaaS product; theming swaps totally per workspace.

## 10. Build order

1. **F1+F2 first** — brand configs, persona builder, KB JSON authoring; verify all three
   agents *sound right* on the bare V1 console before any UI work.
2. `POST /api/session` brand-isolation path (+ F4 language modes — prompt-level only).
3. F3 shell: router, theming, CommandView, Workspace, LeadQueue, PreCall.
4. F5 live qualification rail.
5. Call-end pipeline: summarize (extended) → qualify → QA score → PostCall panels +
   static routing card.
6. F6 handover packet.
7. Polish pass with the frontend-design skill.

## 11. Open items to confirm with the client

- 200-point QA checklist → drops into `rubrics.js` on receipt.
- Arabic dialect (Gulf assumed); Arabic console UI assumed NOT needed.
- Real inventory feeds (KB is clearly-disclaimed demo data).
- Production telephony (SIP/Twilio media-streams path noted in V1 README).
- CRM target for handover (packet shape is CRM-agnostic JSON).

---

## Appendix A — Stage 2 backlog (DO NOT BUILD; seams noted)

| Deferred item | Why deferred | Seam left in POC |
|---|---|---|
| Real lead-routing rules engine | End-to-end logic; demo beat is achievable with a static card | `brand.routingCard` is the data source to replace with `routing/engine.js` |
| Analytics dashboard (live aggregation) | Plumbing, not persuasion | Call logs already persist all inputs (QA, qualification, latency) |
| QA Review queue page (flagged calls, annotations, mark-reviewed) | Workflow tooling | `flagged: true` already persisted per call |
| Lead status lifecycle (new → called → qualified → routed) + history | CRM-ish state machine | Leads file already has the shape; add `status`/`history` fields later |
| Escalation banner / live escalation detection | UI machinery; behavior already exists in persona | Live-extraction endpoint can return `escalationOffered` later |
| QA-fail demo flag / seeded bad-call fixture | Nice-to-have stagecraft | Scorer + flags already work; fixture is a JSON drop-in |
| Cross-brand CommandView metrics strip | Depends on analytics | — |
| Full call-end orchestration w/ routing step | Collapses once routing is real | Client pipeline is already sequential; add one step |
| Telephony (SIP/Twilio), auth, CRM integration, vector-DB retrieval | Production concerns | Provider seam (V1 `providers.js`); CRM-agnostic handover JSON |
