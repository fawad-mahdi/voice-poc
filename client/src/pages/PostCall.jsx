import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useCall } from "../lib/CallContext.jsx";
import { initials } from "../lib/api.js";
import { brandAccent } from "../theme/brandThemes.js";
import Transcript from "../components/Transcript.jsx";
import QualificationRail from "../components/QualificationRail.jsx";
import QAScorecard from "../components/QAScorecard.jsx";
import {
  Check, Sparkle, Activity, Shield, Target, ArrowRight, User, Building,
} from "../components/icons.jsx";

const DISPO_CLASS = {
  "qualified-hot": "dispo-good", "qualified-warm": "dispo-good", "visit-booked": "dispo-good",
  "callback-scheduled": "dispo-warn", "escalated-to-closer": "dispo-warn", nurture: "dispo-warn",
  "not-interested": "dispo-bad",
};
const fmtDuration = (ms) => {
  const s = Math.round((ms || 0) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function PostCall() {
  const { brandId, callId } = useParams();
  const navigate = useNavigate();
  const { brand } = useOutletContext();
  const { post: ctxPost, callConfig } = useCall();
  const [fetched, setFetched] = useState(null);

  // Refresh-resilience: if we landed here without live context, load the log.
  useEffect(() => {
    if ((!ctxPost || ctxPost.callId !== callId) && callId) {
      fetch(`/api/calls/${callId}`).then((r) => (r.ok ? r.json() : null)).then(setFetched).catch(() => {});
    }
  }, [ctxPost, callId]);

  const post = ctxPost?.callId === callId ? ctxPost : fetched
    ? {
        durationMs: fetched.durationMs, latency: fetched.latency, transcript: fetched.transcript || [],
        summary: fetched.summary, disposition: fetched.disposition, brief3: fetched.brief3,
        commitments: fetched.commitments, qualification: fetched.qualification, qa: fetched.qa, callId,
      }
    : ctxPost;

  if (!post) return <div className="page-loading"><Activity size={18} /> Loading call…</div>;

  const lead = callConfig?.lead || fetched?.lead;
  const accent = brandAccent(brandId);
  const temp = post.qualification?.temperature || "cold";
  const assignee = brand.routingCard?.[temp] || brand.routingCard?.cold;
  const items = (post.transcript || []).map((t, i) => ({ ...t, id: i }));

  return (
    <div className="postcall">
      <div className="postcall-grid">
        {/* Summary */}
        <section className="card summary-card rise rise-1">
          <div className="complete-badge"><Check size={14} /> Call complete</div>
          <div className="summary-top">
            <div className="summary-cust">
              <div className="cust-avatar" style={{ background: accent }}>{initials(lead?.name)}</div>
              <div>
                <div className="summary-title">{lead?.name || "Lead"}</div>
                <div className="summary-phone mono">{lead?.phone}</div>
              </div>
            </div>
            {post.disposition
              ? <span className={`dispo ${DISPO_CLASS[post.disposition] || "dispo-muted"}`}>{post.disposition}</span>
              : <span className="dispo dispo-muted">tagging…</span>}
          </div>

          <div className="summary-section-label"><Sparkle size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />AI Summary</div>
          <p className={`summary-text ${post.summary ? "" : "loading"}`}>{post.summary ?? "Generating summary…"}</p>

          <div className="stat-grid">
            <Stat label="Duration" value={fmtDuration(post.durationMs)} />
            <Stat label="Turns" value={post.latency?.turns ?? 0} />
            <Stat label="P50" value={post.latency?.p50 != null ? `${post.latency.p50}` : "—"} unit="ms" tone={tone(post.latency?.p50)} />
            <Stat label="P90" value={post.latency?.p90 != null ? `${post.latency.p90}` : "—"} unit="ms" tone={tone(post.latency?.p90, 800, 1200)} />
          </div>

          <button className="btn btn-primary btn-block btn-lg" disabled={!post.callId} onClick={() => navigate(`/w/${brandId}/handover/${post.callId}`)}>
            <ArrowRight size={18} /> Open handover packet
          </button>
        </section>

        {/* QA scorecard */}
        <section className="card card-pad rise rise-2">
          <div className="section-label"><Shield size={14} /> QA scorecard</div>
          <QAScorecard qa={post.qa} />
        </section>
      </div>

      <div className="postcall-grid">
        {/* Qualification result */}
        <section className="card card-pad rise rise-2">
          <div className="section-label"><Target size={14} /> Qualification result</div>
          {post.qualification ? <QualificationRail q={post.qualification} /> : <PanelSkeleton lines={4} />}
        </section>

        {/* Routing card (STATIC demo dressing) */}
        <section className="card card-pad rise rise-3">
          <div className="section-label"><User size={14} /> Routing</div>
          {post.qualification ? (
            <div className="routing">
              <div className="routing-temp">
                <span className={`temp-dot temp-${temp}`} />
                <span className="routing-temp-label">{temp.toUpperCase()} lead</span>
                <span className="routing-static-tag">static demo · rules engine = Stage 2</span>
              </div>
              <div className="routing-assignee">
                <div className="routing-assignee-mark"><User size={18} /></div>
                <div>
                  <div className="routing-assignee-name">{assignee?.name}</div>
                  <div className="routing-assignee-role">{assignee?.role}</div>
                </div>
              </div>
              <p className="routing-reason"><Building size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />{assignee?.reason}</p>
            </div>
          ) : <PanelSkeleton lines={3} />}
        </section>
      </div>

      <section className="card transcript-card static rise rise-3">
        <div className="transcript-head"><div className="section-label"><Activity size={14} /> Full transcript</div></div>
        <Transcript items={items} />
      </section>
    </div>
  );
}

function tone(ms, good = 500, ok = 800) {
  if (ms == null) return "";
  if (ms <= good) return "val-good";
  if (ms <= ok) return "val-warn";
  return "val-bad";
}
function Stat({ label, value, unit, tone = "" }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone}`}>{value}{unit && value !== "—" && <span style={{ fontSize: 12, color: "var(--faint)" }}> {unit}</span>}</span>
    </div>
  );
}
function PanelSkeleton({ lines = 3 }) {
  return <div className="panel-skeleton">{Array.from({ length: lines }).map((_, i) => <span key={i} />)}</div>;
}
