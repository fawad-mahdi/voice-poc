import React, { useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useFetch, initials } from "../lib/api.js";
import { Users, PhoneCall, Globe, ArrowRight, X } from "../components/icons.jsx";

const TYPE_CLASS = { warm: "pill-warn", hot: "pill-bad", cold: "pill-muted" };
const LANG = { ar: "Arabic", en: "English" };

export default function LeadQueue() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const { brand } = useOutletContext();
  const { data: leads, loading } = useFetch(`/api/leads?brandId=${brandId}`);
  const [openId, setOpenId] = useState(null);

  const open = leads?.find((l) => l.id === openId) || null;

  return (
    <div className="leadqueue">
      <div className="lq-head rise rise-1">
        <div>
          <h1>Leads</h1>
          <p>{brand.name} · pick a lead to open the dossier and start a call.</p>
        </div>
      </div>

      {loading && <div className="page-loading"><Users size={18} /> Loading leads…</div>}

      {leads && (
        <div className="lq-table card rise rise-2">
          <div className="lq-row lq-row-head">
            <span>Lead</span>
            <span>Type</span>
            <span>Source</span>
            <span>Language</span>
            <span />
          </div>
          {leads.map((l) => (
            <button key={l.id} className={`lq-row ${openId === l.id ? "on" : ""}`} onClick={() => setOpenId(l.id)}>
              <span className="lq-lead">
                <span className="lq-avatar">{initials(l.name)}</span>
                <span className="lq-name">{l.name}</span>
              </span>
              <span><span className={`pill ${TYPE_CLASS[l.type] || "pill-muted"}`}>{l.type}</span></span>
              <span className="lq-source">{l.source}</span>
              <span className="lq-lang"><Globe size={13} /> {LANG[l.languagePref] || l.languagePref}</span>
              <span className="lq-chev"><ArrowRight size={16} /></span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <>
          <div className="drawer-scrim" onClick={() => setOpenId(null)} />
          <aside className="drawer rise">
            <div className="drawer-head">
              <div className="drawer-cust">
                <div className="lq-avatar lg">{initials(open.name)}</div>
                <div>
                  <div className="drawer-name">{open.name}</div>
                  <div className="drawer-phone mono">{open.phone}</div>
                </div>
              </div>
              <button className="drawer-close" onClick={() => setOpenId(null)}><X size={18} /></button>
            </div>

            <div className="drawer-body">
              <div className="drawer-pills">
                <span className={`pill ${TYPE_CLASS[open.type] || "pill-muted"}`}>{open.type} lead</span>
                <span className="pill"><Globe size={12} /> Prefers {LANG[open.languagePref] || open.languagePref}</span>
              </div>

              <Field label="Source">{open.source}</Field>
              <Field label="Profile">{open.profile}</Field>
              <Field label="Budget hint">{open.budgetHintAED ? `AED ${open.budgetHintAED.toLocaleString()}` : "—"}</Field>

              <button className="btn btn-primary btn-block btn-lg" onClick={() => navigate(`/w/${brandId}/call/${open.id}`)}>
                <PhoneCall size={18} /> Set up call
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="drawer-field">
      <div className="drawer-field-label">{label}</div>
      <div className="drawer-field-value">{children}</div>
    </div>
  );
}
