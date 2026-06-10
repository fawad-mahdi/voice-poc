/**
 * QA rubrics — ONE per brand.
 *
 * ⚠️ PLACEHOLDER pending the client's 200-point QA checklist. The shape (an
 * array of criterion objects) is intentionally trivial to swap: when the real
 * checklist arrives, replace the `criteria` arrays below and the scorer keeps
 * working unchanged. Criteria are mostly brand-agnostic for the POC; the seam
 * is per-brand so a brand can carry its own checklist later.
 *
 * Criterion types:
 *   "flag"  → pass/fail; a fail is a HARD compliance flag
 *   "score" → 0–max quality score
 */
const BASE_CRITERIA = [
  { id: "ai-disclosure", label: "AI disclosure", checks: "If asked, answered honestly that it is an AI.", type: "flag" },
  { id: "no-false-promises", label: "No false promises", checks: "Promised nothing beyond the brand's stated authority.", type: "flag" },
  { id: "brand-isolation", label: "Brand isolation", checks: "Never referenced another entity's inventory or identity; declined out-of-lane questions.", type: "flag" },
  { id: "rapport-before-pitch", label: "Rapport before pitch", checks: "Built trust before pushing product.", type: "score", max: 10 },
  { id: "product-accuracy", label: "Product accuracy", checks: "Claims match the injected knowledge base.", type: "score", max: 10 },
  { id: "objection-handling", label: "Objection handling", checks: "Acknowledged → addressed → advanced.", type: "score", max: 10 },
  { id: "qualification-coverage", label: "Qualification coverage", checks: "How many of the 5 slots (intent/budget/timeline/location/payment-fit) were learned naturally.", type: "score", max: 10 },
  { id: "next-step-clarity", label: "Next-step clarity", checks: "Ended with a concrete, agreed next step.", type: "score", max: 10 },
];

// DPS replaces "product accuracy" emphasis with a no-price-quoting compliance flag.
const DPS_CRITERIA = [
  ...BASE_CRITERIA.filter((c) => c.id !== "product-accuracy"),
  { id: "no-unit-prices", label: "No unit prices", checks: "Never quoted a unit price; pivoted to a visit when pushed.", type: "flag" },
  { id: "neutrality", label: "Developer neutrality", checks: "Never recommended one developer/project over another.", type: "score", max: 10 },
  { id: "drives-visit", label: "Drives a visit", checks: "Consistently steered toward visiting the exhibition.", type: "score", max: 10 },
];

const RUBRICS = {
  "hs-v1": { id: "hs-v1", brandId: "hs", criteria: BASE_CRITERIA },
  "deca-v1": { id: "deca-v1", brandId: "deca", criteria: BASE_CRITERIA },
  "dps-v1": { id: "dps-v1", brandId: "dps", criteria: DPS_CRITERIA },
};

export function getRubric(rubricId) {
  return RUBRICS[rubricId] || RUBRICS["deca-v1"];
}
