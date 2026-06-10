/**
 * QA scorer — one SUMMARY_MODEL call: transcript + brand persona summary + KB +
 * rubric → strict scorecard JSON. Hard-flag fail OR total < 70 ⇒ flagged.
 */
import { chatJSON, transcriptToText } from "../llm.js";
import { getRubric } from "./rubrics.js";

const FLAG_THRESHOLD = 70;

export async function scoreCall({ transcript = [], brand, knowledge, apiKey }) {
  const rubric = getRubric(brand.rubricId);

  if (!apiKey || transcript.length === 0) {
    return unavailable(rubric);
  }

  const criteriaList = rubric.criteria
    .map((c) => `- ${c.id} (${c.type}${c.type === "score" ? `, 0–${c.max}` : ", pass/fail"}): ${c.label} — ${c.checks}`)
    .join("\n");

  const system =
    `You are a QA reviewer scoring a recorded real-estate sales call for ${brand.name} against a fixed rubric. ` +
    `Score each criterion strictly from the transcript and the knowledge base. ` +
    `For "flag" criteria, score is 1 (pass) or 0 (fail); a fail means a compliance violation. ` +
    `For "score" criteria, give an integer 0–max. ` +
    `Respond ONLY with JSON:\n` +
    `{"criteria":[{"id":"<id>","score":<int>,"max":<int>,"evidence":"<one short quote/justification>"}],` +
    `"flags":[{"criterionId":"<id>","evidence":"<why it failed>"}]}\n` +
    `Include EVERY criterion in "criteria". Put any failed "flag" criterion in "flags".`;

  const user =
    `BRAND PERSONA: ${brand.personaDescriptor}. ${brand.persona.identity}\n\n` +
    `RUBRIC:\n${criteriaList}\n\n` +
    `KNOWLEDGE BASE (for product-accuracy / no-price checks):\n${kbDigest(knowledge)}\n\n` +
    `TRANSCRIPT:\n${transcriptToText(transcript)}`;

  try {
    const parsed = await chatJSON({ apiKey, system, user, temperature: 0.1 });
    return finalize(parsed, rubric);
  } catch (err) {
    console.error("[qa] scoring failed:", err.message);
    return unavailable(rubric);
  }
}

function finalize(parsed, rubric) {
  const modelById = new Map((parsed.criteria || []).map((c) => [c.id, c]));
  const flaggedIds = new Set((parsed.flags || []).map((f) => f.criterionId));

  // Build from the rubric definition so EVERY criterion is present even if the
  // model omitted it. Missing flag criteria default to pass (no violation seen);
  // a flag listed in parsed.flags is a fail. Missing score criteria default 0.
  const criteria = rubric.criteria.map((def) => {
    const m = modelById.get(def.id);
    const max = def.type === "flag" ? 1 : def.max;
    let score;
    if (def.type === "flag") {
      score = flaggedIds.has(def.id) ? 0 : m ? Math.round(Number(m.score)) === 0 ? 0 : 1 : 1;
    } else {
      score = m ? Math.max(0, Math.min(max, Math.round(Number(m.score) || 0))) : 0;
    }
    return { id: def.id, label: def.label, type: def.type, score, max, evidence: m?.evidence || "" };
  });

  // Quality total normalised to 0–100 from the "score" criteria only.
  const scored = criteria.filter((c) => c.type === "score");
  const earned = scored.reduce((s, c) => s + c.score, 0);
  const possible = scored.reduce((s, c) => s + c.max, 0) || 1;
  const total = Math.round((earned / possible) * 100);

  const flags = criteria
    .filter((c) => c.type === "flag" && c.score === 0)
    .map((c) => ({ criterionId: c.id, label: c.label, evidence: c.evidence }));

  const flagged = flags.length > 0 || total < FLAG_THRESHOLD;
  return { rubricId: rubric.id, total, criteria, flags, flagged, available: true };
}

function unavailable(rubric) {
  return {
    rubricId: rubric.id,
    total: null,
    criteria: [],
    flags: [],
    flagged: false,
    available: false,
  };
}

function kbDigest(knowledge) {
  if (!knowledge) return "(none)";
  if (Array.isArray(knowledge.projects)) {
    return knowledge.projects
      .map((p) => `${p.name} (${p.location}): from AED ${p.priceFromAED}, ${p.paymentPlan}, handover ${p.handover}`)
      .join("\n");
  }
  if (knowledge.exhibition) {
    return `${knowledge.exhibition.name}: ${knowledge.pricingPolicy}`;
  }
  return "(none)";
}
