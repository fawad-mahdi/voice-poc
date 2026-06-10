import React from "react";
import { Check, Target } from "./icons.jsx";

const TEMP_CLASS = { hot: "pill-bad", warm: "pill-warn", cold: "pill-muted" };

const INTENT_LABEL = { investment: "Investment", "end-use": "End-use", browsing: "Browsing", unknown: null };
const TIMELINE_LABEL = { "0-3m": "0–3 months", "3-6m": "3–6 months", "6m+": "6+ months", unknown: null };

/** Renders the 5 qualification slots + objection chips. `q` is the §5.4 shape. */
export default function QualificationRail({ q, live = false }) {
  const slots = [
    { key: "intent", label: "Intent", value: INTENT_LABEL[q?.intent] || null },
    { key: "budget", label: "Budget", value: q?.budgetAED ? `AED ${q.budgetAED.toLocaleString()}` : null },
    { key: "timeline", label: "Timeline", value: TIMELINE_LABEL[q?.timeline] || null },
    { key: "location", label: "Location", value: q?.locationInterest?.length ? q.locationInterest.join(", ") : null },
    {
      key: "payment",
      label: "Payment-plan fit",
      value: q?.paymentPlanFit === true ? "Yes" : q?.paymentPlanFit === false ? "No" : null,
    },
  ];
  const filled = slots.filter((s) => s.value != null).length;

  return (
    <div className="qual">
      {live && (
        <div className="qual-progress">
          <span className="mono">{filled}/5 captured</span>
          <div className="qual-bar"><div className="qual-bar-fill" style={{ width: `${(filled / 5) * 100}%` }} /></div>
        </div>
      )}

      <div className="qual-slots">
        {slots.map((s) => (
          <div key={s.key} className={`qual-slot ${s.value != null ? "filled" : "pending"}`}>
            <span className="qual-slot-tick">{s.value != null ? <Check size={12} /> : <span className="qual-dot" />}</span>
            <span className="qual-slot-label">{s.label}</span>
            <span className="qual-slot-value">{s.value ?? (live ? "listening…" : "—")}</span>
          </div>
        ))}
      </div>

      <div className="qual-objections">
        <div className="qual-sub">Objections</div>
        {q?.objections?.length ? (
          <div className="obj-chips">
            {q.objections.map((o, i) => (
              <span key={i} className={`obj-chip ${o.handled ? "handled" : "open"}`}>
                {o.handled ? <Check size={11} /> : <Target size={11} />} {o.objection}
              </span>
            ))}
          </div>
        ) : (
          <div className="qual-empty">{live ? "none raised yet" : "none raised"}</div>
        )}
      </div>

      {!live && q && (
        <>
          <div className="qual-temp">
            <span className="qual-sub">Temperature</span>
            <span className={`pill ${TEMP_CLASS[q.temperature] || "pill-muted"}`}>{q.temperature}</span>
          </div>
          {q.facts?.length > 0 && (
            <div className="qual-facts">
              <div className="qual-sub">Facts captured</div>
              <ul>{q.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
