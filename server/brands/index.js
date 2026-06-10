/**
 * Brand registry — the single source of truth for the three isolated brands.
 *
 * STRUCTURAL ISOLATION (the whole point of V2): a request carries a brandId;
 * everything downstream — persona, knowledge, policy, authority, dispositions,
 * rubric, routing — is resolved from THAT brand's config only. No brand's data
 * is ever loaded into another brand's session. getBrand() is the only door in.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import hs from "./hs.js";
import deca from "./deca.js";
import dps from "./dps.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, "..");

const BRANDS = { hs, deca, dps };

// Knowledge is read once at startup and cached per brand. Each brand only ever
// sees its own file — there is no path through which one brand's KB reaches
// another brand's session.
const knowledgeCache = new Map();
function loadKnowledge(brand) {
  if (knowledgeCache.has(brand.id)) return knowledgeCache.get(brand.id);
  let data = null;
  try {
    const raw = fs.readFileSync(path.join(SERVER_DIR, brand.knowledgeFile), "utf8");
    data = JSON.parse(raw);
  } catch (err) {
    console.warn(`[brands] could not load knowledge for ${brand.id}:`, err.message);
  }
  knowledgeCache.set(brand.id, data);
  return data;
}

/** The one accessor. Throws on unknown brand so isolation can't silently leak. */
export function getBrand(id) {
  const brand = BRANDS[id];
  if (!brand) {
    throw new Error(`Unknown brand "${id}". Available: ${Object.keys(BRANDS).join(", ")}`);
  }
  return brand;
}

/** Brand + its (own) knowledge, for persona compilation. */
export function getBrandWithKnowledge(id) {
  const brand = getBrand(id);
  return { brand, knowledge: loadKnowledge(brand) };
}

/** Lightweight list for the CommandView (no persona internals, no full KB). */
export function listBrands(leadCounts = {}) {
  return Object.values(BRANDS).map((b) => ({
    id: b.id,
    name: b.name,
    tagline: b.tagline,
    theme: b.theme,
    personaDescriptor: b.personaDescriptor,
    leadCount: leadCounts[b.id] ?? 0,
  }));
}

/** Project/exhibition name list for the dossier — NOT the full KB. */
export function knowledgeSummary(id) {
  const { knowledge } = getBrandWithKnowledge(id);
  if (!knowledge) return [];
  if (Array.isArray(knowledge.projects)) {
    return knowledge.projects.map((p) => ({ name: p.name, location: p.location }));
  }
  if (knowledge.exhibition) {
    return [{ name: knowledge.exhibition.name, location: knowledge.exhibition.location }];
  }
  return [];
}

/** Config the UI may safely see (no raw persona prompt, no full KB). */
export function publicBrandConfig(id) {
  const b = getBrand(id);
  return {
    id: b.id,
    name: b.name,
    tagline: b.tagline,
    theme: b.theme,
    personaDescriptor: b.personaDescriptor,
    policy: b.policy,
    authority: b.authority,
    dispositions: b.dispositions,
    routingCard: b.routingCard,
    projects: knowledgeSummary(id),
  };
}
