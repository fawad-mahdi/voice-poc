/**
 * Qualification extraction — turns a (rolling or full) transcript into the
 * structured §5.4 qualification object. Used live during the call (partial,
 * every 3rd customer turn) and once at call end (final, complete).
 *
 * Always SUMMARY_MODEL, never on the audio path. Partial fields are allowed —
 * unknowns stay "unknown"/null so the live checklist can fill in over time.
 */
import { chatJSON, transcriptToText } from "./llm.js";

const SHAPE = `{
  "intent": "investment | end-use | browsing | unknown",
  "budgetAED": <number or null>,
  "timeline": "0-3m | 3-6m | 6m+ | unknown",
  "locationInterest": [<strings>],
  "paymentPlanFit": <true | false | null>,
  "objections": [{ "objection": "<short>", "handled": <true|false> }],
  "temperature": "hot | warm | cold",
  "facts": [<short strings the closer should not re-ask>]
}`;

const EMPTY = {
  intent: "unknown",
  budgetAED: null,
  timeline: "unknown",
  locationInterest: [],
  paymentPlanFit: null,
  objections: [],
  temperature: "cold",
  facts: [],
};

/**
 * @param {object}  opts
 * @param {array}   opts.transcript  [{role,text}]
 * @param {string}  opts.apiKey
 * @param {boolean} opts.partial     live (true) vs final (false)
 */
export async function extractQualification({ transcript = [], apiKey, partial = false }) {
  if (!apiKey || transcript.length === 0) return { ...EMPTY };

  const system =
    `You extract sales-qualification signals from a real-estate voice call. ` +
    `Respond ONLY with JSON in EXACTLY this shape:\n${SHAPE}\n` +
    `Rules: only report what the transcript supports; leave anything not yet known as "unknown"/null/[]. ` +
    `temperature: hot = ready to act + budget/timeline clear; warm = engaged but not committed; cold = browsing/low intent. ` +
    `${partial ? "This is a PARTIAL mid-call transcript; do not over-infer." : "This is the COMPLETE call."}`;

  try {
    const parsed = await chatJSON({
      apiKey,
      system,
      user: `Transcript:\n${transcriptToText(transcript)}`,
      temperature: partial ? 0.1 : 0.2,
    });
    return normalize(parsed);
  } catch (err) {
    console.error(`[qualify] ${partial ? "live" : "final"} extraction failed:`, err.message);
    return { ...EMPTY };
  }
}

function normalize(p = {}) {
  return {
    intent: p.intent || "unknown",
    budgetAED: typeof p.budgetAED === "number" ? p.budgetAED : null,
    timeline: p.timeline || "unknown",
    locationInterest: Array.isArray(p.locationInterest) ? p.locationInterest : [],
    paymentPlanFit: typeof p.paymentPlanFit === "boolean" ? p.paymentPlanFit : null,
    objections: Array.isArray(p.objections)
      ? p.objections
          .filter((o) => o && o.objection)
          .map((o) => ({ objection: String(o.objection), handled: !!o.handled }))
      : [],
    temperature: ["hot", "warm", "cold"].includes(p.temperature) ? p.temperature : "cold",
    facts: Array.isArray(p.facts) ? p.facts.map(String) : [],
  };
}
