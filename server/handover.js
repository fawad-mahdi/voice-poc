/**
 * Handover packet assembler — composes the closer-facing packet from a stored
 * call record (transcript + latency + summary/brief3/commitments + qualification
 * + qa) plus the brand's routing card. No model call: everything was produced
 * earlier in the call-end pipeline and persisted to the call log.
 */
import { getBrand } from "./brands/index.js";

export function assembleHandover(record) {
  const brand = getBrand(record.brandId);
  const qualification = record.qualification || null;
  const temperature = qualification?.temperature || "cold";
  const assignee = brand.routingCard[temperature] || brand.routingCard.cold;

  const dossier = qualification
    ? {
        intent: qualification.intent,
        budgetAED: qualification.budgetAED,
        timeline: qualification.timeline,
        locationInterest: qualification.locationInterest,
        paymentPlanFit: qualification.paymentPlanFit,
        facts: qualification.facts,
        objections: qualification.objections,
      }
    : null;

  return {
    callId: record.id,
    brand: { id: brand.id, name: brand.name, theme: brand.theme },
    lead: record.lead || null,
    header: {
      name: record.lead?.name || "Unknown lead",
      temperature,
      assignee,
      meta: `AI call · ${formatDate(record.endedAt)} · ${formatDuration(record.durationMs)}`,
    },
    brief3: record.brief3 || [],
    commitments: record.commitments || [],
    dossier,
    dontReAsk: dossier ? buildDontReAsk(dossier) : "",
    qa: record.qa ? { total: record.qa.total, flagged: record.qa.flagged } : null,
    disposition: record.disposition || null,
    transcript: record.transcript || [],
  };
}

function buildDontReAsk(d) {
  const known = [];
  if (d.budgetAED) known.push("budget");
  if (d.timeline && d.timeline !== "unknown") known.push("timeline");
  if (d.locationInterest?.length) known.push("location");
  if (!known.length) return "";
  return `Don't re-ask: ${known.join(", ")} — captured above.`;
}

function formatDuration(ms) {
  const s = Math.round((ms || 0) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
