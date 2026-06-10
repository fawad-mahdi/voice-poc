import React from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../lib/api.js";
import { brandAccent } from "../theme/brandThemes.js";
import { ArrowRight, Users, Sparkle, Lock } from "../components/icons.jsx";

const MARK = { hs: "H&S", deca: "DC", dps: "DPS" };

export default function CommandView() {
  const navigate = useNavigate();
  const { data: brands, loading, error } = useFetch("/api/brands");

  return (
    <div className="command">
      <header className="command-top">
        <div className="command-brandline">
          <div className="command-logo"><Sparkle size={20} /></div>
          <div>
            <div className="command-logo-name">Auth-Machine</div>
            <div className="command-logo-tag">AI Sales Automation</div>
          </div>
        </div>
        <span className="pill"><Lock size={12} /> Brand-isolated sessions</span>
      </header>

      <div className="command-hero rise rise-1">
        <span className="eyebrow command-eyebrow">
          <span className="tridot"><i /><i /><i /></span> Command view
        </span>
        <h1>One platform.<br />Three brands, three agents.</h1>
        <p>
          Each agent's persona, knowledge and rules are compiled from its own
          workspace only — no brand's data ever enters another's session. Enter a
          workspace and the entire console re-skins.
        </p>
      </div>

      {loading && <div className="command-grid">{[0, 1, 2].map((i) => <div key={i} className="card brand-card skeleton-card" />)}</div>}
      {error && <div className="error-banner"><span>Couldn't load brands ({error}). Is the server running?</span></div>}

      {brands && (
        <div className="command-grid">
          {brands.map((b, i) => {
            const accent = brandAccent(b.id);
            return (
              <button
                key={b.id}
                className={`card brand-card rise rise-${Math.min(i + 1, 4)}`}
                style={{ "--card-accent": accent }}
                data-brand={b.id}
                data-mark={MARK[b.id] || b.id.toUpperCase()}
                onClick={() => navigate(`/w/${b.id}/leads`)}
              >
                <div className="brand-card-accent" />
                <div className="brand-card-mark">{MARK[b.id] || b.id.toUpperCase()}</div>
                <div className="brand-card-name">{b.name}</div>
                <div className="brand-card-tagline">{b.tagline}</div>
                <div className="brand-card-persona">{b.personaDescriptor}</div>
                <div className="brand-card-foot">
                  <span className="brand-card-leads"><Users size={14} /> {b.leadCount} {b.leadCount === 1 ? "lead" : "leads"}</span>
                  <span className="brand-card-enter">Enter workspace <ArrowRight size={15} /></span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="command-caps rise rise-4">
        <span>Realtime voice</span><i /><span>Arabic code-switching</span><i />
        <span>Live qualification</span><i /><span>QA scorecards</span><i />
        <span>Handover packets</span>
      </div>
    </div>
  );
}
