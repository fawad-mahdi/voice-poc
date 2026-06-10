import React, { useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useFetch, initials } from "../lib/api.js";
import { useCall } from "../lib/CallContext.jsx";
import { stancesFor } from "../lib/stances.js";
import { brandAccent } from "../theme/brandThemes.js";
import {
  PhoneCall, Globe, Shield, ChevronDown, Languages, Lock, Building, X,
} from "../components/icons.jsx";

const LANG_MODES = [
  { id: "auto", label: "Auto" },
  { id: "en", label: "English" },
  { id: "ar", label: "Arabic" },
];
const LANG = { ar: "Arabic", en: "English" };

export default function PreCall() {
  const { brandId, leadId } = useParams();
  const navigate = useNavigate();
  const { brand } = useOutletContext();
  const { startCall, error } = useCall();
  const { data: leads } = useFetch(`/api/leads?brandId=${brandId}`);
  const lead = leads?.find((l) => l.id === leadId) || null;

  const stances = stancesFor(brandId);
  const [languageMode, setLanguageMode] = useState("auto");
  const [goalOverride, setGoalOverride] = useState("");
  const [stanceId, setStanceId] = useState(stances[0].id);
  const [starting, setStarting] = useState(false);

  if (!lead) return <div className="page-loading">Loading lead…</div>;

  const start = async () => {
    const stance = stances.find((s) => s.id === stanceId) || stances[0];
    setStarting(true);
    try {
      await startCall({
        brand, lead, languageMode, goalOverride,
        stanceLabel: stance.label, stanceCue: stance.cue,
      });
      navigate(`/w/${brandId}/live`);
    } catch {
      setStarting(false);
    }
  };

  return (
    <div className="precall">
      <div className="precall-main">
        {/* Dossier */}
        <div className="card card-pad rise rise-1">
          <div className="cust-head">
            <div className="cust-avatar" style={{ background: brandAccent(brandId) }}>{initials(lead.name)}</div>
            <div className="cust-head-text">
              <h2>{lead.name}</h2>
              <div className="phone mono">{lead.phone}</div>
            </div>
            <span className="iso-chip ml-auto" title="Persona, knowledge and rules are compiled from this brand only at call start.">
              <Lock size={13} /> Isolated context
            </span>
          </div>

          <div className="dossier-grid">
            <Field label="Type">{lead.type} lead</Field>
            <Field label="Prefers"><Globe size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{LANG[lead.languagePref] || lead.languagePref}</Field>
            <Field label="Budget hint">{lead.budgetHintAED ? `AED ${lead.budgetHintAED.toLocaleString()}` : "—"}</Field>
            <Field label="Source" wide>{lead.source}</Field>
            <Field label="Profile" wide>{lead.profile}</Field>
          </div>

          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor="goal">Call goal — injected into the agent (optional override)</label>
            <textarea
              id="goal" className="textarea" rows={2} value={goalOverride}
              onChange={(e) => setGoalOverride(e.target.value)}
              placeholder={lead.type === "warm"
                ? "Default: reference the enquiry, deepen it, qualify, advance to a next step."
                : "Default: introduce, understand the situation, qualify, book a low-pressure next step."}
            />
          </div>

          {/* Policy & Authority */}
          <details className="disclosure" style={{ marginTop: 16 }}>
            <summary>
              <Shield className="lead" size={16} />
              Policy &amp; authority the agent reasons against
              <ChevronDown className="chev" size={16} />
            </summary>
            <div className="disclosure-body">
              <div className="policy-block">
                <div className="policy-block-label">Policy</div>
                <pre className="policy-pre">{brand.policy}</pre>
              </div>
              <div className="policy-block">
                <div className="policy-block-label">Can do alone</div>
                <pre className="policy-pre auth">{(brand.authority?.canDoAlone || []).map((x) => `• ${x}`).join("\n")}</pre>
              </div>
              <div className="policy-block">
                <div className="policy-block-label">Must escalate</div>
                <pre className="policy-pre">{(brand.authority?.mustEscalate || []).map((x) => `• ${x}`).join("\n")}</pre>
              </div>
            </div>
          </details>

          {brand.projects?.length > 0 && (
            <div className="kb-strip">
              <div className="section-label" style={{ marginBottom: 10 }}><Building size={14} /> Knowledge in this session</div>
              <div className="kb-chips">
                {brand.projects.map((p) => (
                  <span key={p.name} className="kb-chip" title={p.location}>{p.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right rail: language + stance + launch */}
      <aside className="precall-aside rise rise-2">
        <div className="card card-pad">
          <div className="section-label"><Languages size={14} /> Language mode</div>
          <div className="seg">
            {LANG_MODES.map((m) => (
              <button key={m.id} className={`seg-btn ${languageMode === m.id ? "on" : ""}`} onClick={() => setLanguageMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="aside-note" style={{ marginTop: 10 }}>
            {languageMode === "auto"
              ? `Opens in the lead's preferred language (${LANG[lead.languagePref]}); mirrors the customer mid-call.`
              : languageMode === "ar"
              ? "Agent opens in Gulf Arabic and mirrors thereafter."
              : "Agent speaks English; follows if the customer switches to Arabic."}
          </p>
        </div>

        <div className="card card-pad">
          <div className="section-label"><PhoneCall size={14} /> Your role (operator)</div>
          <div className="stance-list">
            {stances.map((st) => (
              <button key={st.id} className={`stance-card ${stanceId === st.id ? "on" : ""}`} onClick={() => setStanceId(st.id)} aria-pressed={stanceId === st.id}>
                <span className="stance-radio" />
                <span className="stance-label">{st.label}</span>
              </button>
            ))}
          </div>
          <p className="aside-note" style={{ marginTop: 12 }}>
            The agent is <strong>not</strong> told your stance — it handles whatever you bring, live.
          </p>
        </div>

        {error && <div className="error-banner"><X size={16} /><span>{error}</span></div>}

        <button className="btn btn-primary btn-block btn-lg" onClick={start} disabled={starting}>
          <PhoneCall size={18} /> {starting ? "Connecting…" : "Start call"}
        </button>
      </aside>
    </div>
  );
}

function Field({ label, children, wide }) {
  return (
    <div className={`dossier-field ${wide ? "wide" : ""}`}>
      <div className="dossier-field-label">{label}</div>
      <div className="dossier-field-value">{children}</div>
    </div>
  );
}
