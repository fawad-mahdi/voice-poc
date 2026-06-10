import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFetch, initials } from "../lib/api.js";
import { brandAccent } from "../theme/brandThemes.js";
import Transcript from "../components/Transcript.jsx";
import QualificationRail from "../components/QualificationRail.jsx";
import {
  ArrowLeft, User, Check, FileText, Activity, ChevronDown, Send, Shield, Lock,
} from "../components/icons.jsx";

const TEMP_CLASS = { hot: "pill-bad", warm: "pill-warn", cold: "pill-muted" };

export default function HandoverPacket() {
  const { brandId, callId } = useParams();
  const navigate = useNavigate();
  const { data: packet, loading, error } = useFetch(`/api/handover/${callId}`);
  const [sent, setSent] = useState(false);

  if (loading) return <div className="page-loading"><Activity size={18} /> Assembling packet…</div>;
  if (error || !packet) return <div className="error-banner"><span>Couldn't load packet ({error}).</span></div>;

  const accent = brandAccent(brandId);
  const { header, brief3, commitments, dossier, dontReAsk, qa, transcript } = packet;
  const items = (transcript || []).map((t, i) => ({ ...t, id: i }));

  const send = () => {
    setSent(true);
    setTimeout(() => setSent(false), 2600);
  };

  return (
    <div className="handover">
      <button className="back-link" onClick={() => navigate(`/w/${brandId}/post/${callId}`)}>
        <ArrowLeft size={15} /> Back to call summary
      </button>

      {/* Header */}
      <div className="card handover-header rise rise-1">
        <div className="handover-cust">
          <div className="cust-avatar lg" style={{ background: accent }}>{initials(header.name)}</div>
          <div>
            <div className="handover-name">{header.name}</div>
            <div className="handover-meta">{header.meta}</div>
          </div>
        </div>
        <div className="handover-header-right">
          <span className={`pill ${TEMP_CLASS[header.temperature]}`}>{header.temperature} lead</span>
          {qa && (qa.flagged
            ? <span className="dispo dispo-bad">QA flagged</span>
            : qa.total != null && <span className="dispo dispo-good">QA {qa.total}/100</span>)}
        </div>
      </div>

      <div className="handover-grid">
        <div className="handover-col">
          {/* Read this first */}
          <section className="card card-pad rise rise-2 brief-card">
            <div className="section-label"><FileText size={14} /> Read this first</div>
            {brief3?.length ? (
              <ol className="brief-list">
                {brief3.map((b, i) => <li key={i}><span className="brief-num">{i + 1}</span>{b}</li>)}
              </ol>
            ) : <p className="qual-empty">Brief unavailable.</p>}
          </section>

          {/* Commitments */}
          <section className="card card-pad rise rise-2">
            <div className="section-label"><Check size={14} /> Commitments the agent made</div>
            {commitments?.length ? (
              <ul className="commit-list">
                {commitments.map((c, i) => <li key={i}><Check size={14} /> {c}</li>)}
              </ul>
            ) : <p className="qual-empty">No explicit commitments — nothing promised that needs honouring.</p>}
            <div className="commit-guarantee"><Lock size={12} /> No dropped context: every promise above is carried to the closer.</div>
          </section>

          {/* Don't re-ask */}
          {dontReAsk && <div className="dont-reask"><Shield size={15} /> {dontReAsk}</div>}
        </div>

        <div className="handover-col">
          {/* Routing assignee */}
          <section className="card card-pad rise rise-2">
            <div className="section-label"><User size={14} /> Assigned to</div>
            <div className="routing-assignee">
              <div className="routing-assignee-mark"><User size={18} /></div>
              <div>
                <div className="routing-assignee-name">{header.assignee?.name}</div>
                <div className="routing-assignee-role">{header.assignee?.role}</div>
              </div>
            </div>
            <p className="routing-reason">{header.assignee?.reason}</p>
            <button className={`btn ${sent ? "btn-ghost" : "btn-primary"} btn-block`} onClick={send}>
              {sent ? <><Check size={16} /> Sent to CRM</> : <><Send size={16} /> Send to {header.assignee?.name} via CRM</>}
            </button>
          </section>

          {/* Qualification dossier */}
          <section className="card card-pad rise rise-3">
            <div className="section-label"><Activity size={14} /> Qualification dossier</div>
            {dossier ? <QualificationRail q={dossier} /> : <p className="qual-empty">No qualification captured.</p>}
          </section>
        </div>
      </div>

      {/* Transcript, collapsed */}
      <details className="card handover-transcript rise rise-3">
        <summary><Activity size={14} /> Full transcript <ChevronDown className="chev" size={16} /></summary>
        <div className="handover-transcript-body"><Transcript items={items} /></div>
      </details>
    </div>
  );
}
