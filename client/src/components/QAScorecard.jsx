import React from "react";
import { Shield, Check, X, Activity } from "./icons.jsx";

const ringTone = (t) => (t == null ? "" : t >= 85 ? "good" : t >= 70 ? "warn" : "bad");

export default function QAScorecard({ qa }) {
  if (!qa) {
    return (
      <div className="qa-skeleton">
        <div className="skeleton-ring" />
        <div className="skeleton-lines"><span /><span /><span /></div>
      </div>
    );
  }

  if (!qa.available) {
    return (
      <div className="qa-unavailable">
        <Shield size={20} />
        <div>
          <div className="qa-unavailable-title">Scorecard unavailable</div>
          <p>No API key configured, or no transcript to score. The call still saved.</p>
        </div>
      </div>
    );
  }

  const tone = ringTone(qa.total);
  const flagCriteria = qa.criteria.filter((c) => c.type === "flag");
  const scoreCriteria = qa.criteria.filter((c) => c.type === "score");
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="qa">
      <div className="qa-top">
        <div className={`qa-ring qa-${tone}`}>
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r={R} className="qa-ring-track" />
            <circle
              cx="60" cy="60" r={R} className="qa-ring-fill"
              strokeDasharray={C} strokeDashoffset={C * (1 - (qa.total || 0) / 100)}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="qa-ring-label">
            <span className="qa-ring-num">{qa.total}</span>
            <span className="qa-ring-max">/100</span>
          </div>
        </div>
        <div className="qa-verdict">
          {qa.flagged ? (
            <span className="dispo dispo-bad"><X size={13} /> Flagged for review</span>
          ) : (
            <span className="dispo dispo-good"><Check size={13} /> Passed QA</span>
          )}
          <p className="qa-verdict-note">
            {qa.flags.length > 0
              ? `${qa.flags.length} hard compliance ${qa.flags.length === 1 ? "flag" : "flags"}.`
              : qa.total < 70
              ? "Quality below the 70 threshold."
              : "No compliance flags; quality above threshold."}
          </p>
        </div>
      </div>

      {/* Compliance flags (pass/fail) */}
      <div className="qa-flags-row">
        {flagCriteria.map((c) => (
          <span key={c.id} className={`qa-flag ${c.score === 1 ? "pass" : "fail"}`} title={c.evidence}>
            {c.score === 1 ? <Check size={12} /> : <X size={12} />} {c.label}
          </span>
        ))}
      </div>

      {/* Quality bars */}
      <div className="qa-bars">
        {scoreCriteria.map((c) => (
          <div key={c.id} className="qa-bar-row" title={c.evidence}>
            <span className="qa-bar-label">{c.label}</span>
            <div className="qa-bar-track">
              <div className={`qa-bar-fill qa-${ringTone((c.score / c.max) * 100)}`} style={{ width: `${(c.score / c.max) * 100}%` }} />
            </div>
            <span className="qa-bar-num mono">{c.score}/{c.max}</span>
          </div>
        ))}
      </div>

      {qa.flags.length > 0 && (
        <div className="qa-flag-list">
          <div className="qual-sub"><Activity size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />Hard flags</div>
          {qa.flags.map((f, i) => (
            <div key={i} className="qa-flag-item"><strong>{f.label}:</strong> {f.evidence}</div>
          ))}
        </div>
      )}
    </div>
  );
}
