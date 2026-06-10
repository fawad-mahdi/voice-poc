/**
 * Voice Agent POC — V2 backend (multi-brand).
 *
 * V1 core is unchanged in spirit: the browser talks WebRTC directly to the
 * voice provider; this server is the only place the real API key lives, and it
 * mints ephemeral tokens with the agent persona baked in.
 *
 * V2 adds brand isolation: a request carries a brandId, and persona, knowledge,
 * policy, authority, dispositions, rubric and routing are resolved from THAT
 * brand only (server/brands). No brand's data is ever present in another
 * brand's session.
 */
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { buildPersona } from "./persona.js";
import { getProvider } from "./providers.js";
import {
  getBrandWithKnowledge,
  listBrands,
  publicBrandConfig,
} from "./brands/index.js";
import { chatJSON, transcriptToText } from "./llm.js";
import { extractQualification } from "./qualify.js";
import { scoreCall } from "./qa/scorer.js";
import { assembleHandover } from "./handover.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, "data", "calls");
await fs.mkdir(DATA_DIR, { recursive: true });

// Seeded leads (read-only for the POC).
const LEADS = JSON.parse(
  await fs.readFile(path.join(__dirname, "leads", "seed.json"), "utf8")
);
const leadCounts = LEADS.reduce((acc, l) => ((acc[l.brandId] = (acc[l.brandId] || 0) + 1), acc), {});

const app = express();
app.use(express.json({ limit: "2mb" }));

const haveKey = () => {
  const k = process.env.OPENAI_API_KEY;
  return k && !k.startsWith("sk-...");
};

/* ── Call-log persistence helpers ────────────────────────────────────────── */
const callPath = (id) => path.join(DATA_DIR, `${id.replace(/[^a-zA-Z0-9_]/g, "")}.json`);

async function readCall(id) {
  const raw = await fs.readFile(callPath(id), "utf8");
  return JSON.parse(raw);
}
async function writeCall(record) {
  await fs.writeFile(callPath(record.id), JSON.stringify(record, null, 2));
  return record;
}
async function patchCall(id, partial) {
  const record = await readCall(id);
  const next = { ...record, ...partial };
  await writeCall(next);
  return next;
}

/* ══ Brands & leads ═════════════════════════════════════════════════════════ */
app.get("/api/brands", (_req, res) => res.json(listBrands(leadCounts)));

app.get("/api/brands/:id", (req, res) => {
  try {
    res.json(publicBrandConfig(req.params.id));
  } catch {
    res.status(404).json({ error: "Unknown brand" });
  }
});

app.get("/api/leads", (req, res) => {
  const { brandId } = req.query;
  res.json(brandId ? LEADS.filter((l) => l.brandId === brandId) : LEADS);
});

/* ══ 1. Ephemeral session token (brand-isolated) ═══════════════════════════ */
app.post("/api/session", async (req, res) => {
  if (!haveKey()) {
    return res.status(503).json({
      error: "OPENAI_API_KEY is not configured. Copy .env.example to .env and set your key.",
    });
  }

  const { brandId, leadId, languageMode = "auto", goalOverride = "" } = req.body || {};
  if (!brandId) return res.status(400).json({ error: "brandId is required" });

  let brand, knowledge;
  try {
    // Isolation boundary: resolve persona/knowledge/policy from THIS brand only.
    ({ brand, knowledge } = getBrandWithKnowledge(brandId));
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
  const lead = LEADS.find((l) => l.id === leadId && l.brandId === brandId) || null;

  const provider = getProvider(process.env.VOICE_PROVIDER || "openai");
  try {
    const session = await provider.createSession({
      apiKey: process.env.OPENAI_API_KEY,
      instructions: buildPersona({
        brand,
        knowledge,
        lead,
        callConfig: { languageMode, goalOverride },
      }),
      model: process.env.REALTIME_MODEL || "gpt-realtime-2",
      voice: process.env.REALTIME_VOICE || "marin",
      vadSilenceMs: Number(process.env.VAD_SILENCE_MS || 400),
    });
    res.json({ ...session, brandId, leadId: lead?.id || null });
  } catch (err) {
    console.error("[session] token mint failed:", err.message);
    res.status(502).json({ error: `Failed to create realtime session: ${err.message}` });
  }
});

/* ══ 2 + 3. Call log persistence ═══════════════════════════════════════════ */
app.post("/api/calls", async (req, res) => {
  const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = await writeCall({ id, savedAt: new Date().toISOString(), ...req.body });
  res.json({ id });
});

app.get("/api/calls/:id", async (req, res) => {
  try {
    res.json(await readCall(req.params.id));
  } catch {
    res.status(404).json({ error: "Call not found" });
  }
});

/* ══ 4. Post-call summary + disposition + brief3 + commitments ═════════════ */
app.post("/api/summarize", async (req, res) => {
  const { transcript = [], goal = "", dispositions, callId } = req.body || {};
  const allowed = Array.isArray(dispositions) && dispositions.length ? dispositions : [
    "qualified-hot", "qualified-warm", "nurture", "not-interested",
    "escalated-to-closer", "callback-scheduled",
  ];

  const fallback = () => ({
    summary:
      transcript.length === 0
        ? "Call ended before any conversation took place."
        : `Call covering: ${goal || "general follow-up"}. ${transcript.length} turns exchanged.`,
    disposition: transcript.length === 0 ? "not-interested" : "nurture",
    brief3: [],
    commitments: [],
  });

  let result;
  if (!haveKey() || transcript.length === 0) {
    result = fallback();
  } else {
    try {
      const parsed = await chatJSON({
        apiKey: process.env.OPENAI_API_KEY,
        system:
          `You summarize real-estate sales calls for a closer who will take over. Respond ONLY with JSON: ` +
          `{"summary":"<2-3 factual sentences, note the resolution or next step>",` +
          `"disposition":"<one of: ${allowed.join(", ")}>",` +
          `"brief3":["<who they are>","<what they want>","<what was promised/agreed>"],` +
          `"commitments":["<each concrete commitment the AGENT made on the call; [] if none>"]}`,
        user: `Call goal: ${goal}\n\nTranscript:\n${transcriptToText(transcript)}`,
      });
      if (!allowed.includes(parsed.disposition)) parsed.disposition = "nurture";
      result = {
        summary: parsed.summary,
        disposition: parsed.disposition,
        brief3: Array.isArray(parsed.brief3) ? parsed.brief3.slice(0, 3) : [],
        commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
      };
    } catch (err) {
      console.error("[summarize] failed, using fallback:", err.message);
      result = fallback();
    }
  }

  if (callId) await patchCall(callId, result).catch(() => {});
  res.json(result);
});

/* ══ 5. Live qualification (partial, async, off the audio path) ════════════ */
app.post("/api/qualify/live", async (req, res) => {
  const { transcript = [] } = req.body || {};
  const q = await extractQualification({
    transcript,
    apiKey: process.env.OPENAI_API_KEY,
    partial: true,
  });
  res.json(q);
});

/* ══ 5b. Final qualification (complete, persisted) ═════════════════════════ */
app.post("/api/qualify", async (req, res) => {
  const { callId } = req.body || {};
  let transcript = req.body?.transcript || [];
  if (callId) {
    try {
      transcript = (await readCall(callId)).transcript || transcript;
    } catch {
      return res.status(404).json({ error: "Call not found" });
    }
  }
  const qualification = await extractQualification({
    transcript,
    apiKey: process.env.OPENAI_API_KEY,
    partial: false,
  });
  if (callId) await patchCall(callId, { qualification }).catch(() => {});
  res.json(qualification);
});

/* ══ 6. QA scorecard (persisted; sets flagged) ═════════════════════════════ */
app.post("/api/qa/score", async (req, res) => {
  const { callId } = req.body || {};
  let record;
  try {
    record = await readCall(callId);
  } catch {
    return res.status(404).json({ error: "Call not found" });
  }
  let brand, knowledge;
  try {
    ({ brand, knowledge } = getBrandWithKnowledge(record.brandId));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const qa = await scoreCall({
    transcript: record.transcript || [],
    brand,
    knowledge,
    apiKey: process.env.OPENAI_API_KEY,
  });
  await patchCall(callId, { qa, flagged: qa.flagged }).catch(() => {});
  res.json(qa);
});

/* ══ 7. Handover packet ════════════════════════════════════════════════════ */
app.get("/api/handover/:callId", async (req, res) => {
  let record;
  try {
    record = await readCall(req.params.callId);
  } catch {
    return res.status(404).json({ error: "Call not found" });
  }
  try {
    res.json(assembleHandover(record));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ── Static serving for production build ─────────────────────────────────── */
if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] voice provider: ${process.env.VOICE_PROVIDER || "openai"}`);
  console.log(`[server] brands: ${listBrands().map((b) => b.id).join(", ")} · ${LEADS.length} leads`);
});
