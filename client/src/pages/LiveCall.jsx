import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCall } from "../lib/CallContext.jsx";
import { initials } from "../lib/api.js";
import { brandAccent } from "../theme/brandThemes.js";
import Transcript from "../components/Transcript.jsx";
import MicMeter from "../components/MicMeter.jsx";
import QualificationRail from "../components/QualificationRail.jsx";
import { PhoneCall, Mic, Gauge, Activity, X, Target } from "../components/icons.jsx";

function useElapsed(startedAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - (startedAt || now)) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function LiveCall() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const {
    phase, status, error, transcript, agentSpeaking, micStream,
    displayedP50, turnCount, callConfig, liveQual, startedAt, endCall,
  } = useCall();
  const elapsed = useElapsed(startedAt);
  const [ending, setEnding] = useState(false);
  const endedRef = useRef(false);

  // Direct nav with no active call → back to leads.
  useEffect(() => {
    if (phase === "idle") navigate(`/w/${brandId}/leads`, { replace: true });
  }, [phase, brandId, navigate]);

  if (phase !== "in-call") return null;

  const lead = callConfig?.lead;
  const live = status === "Live";
  const accent = brandAccent(brandId);

  const end = async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEnding(true);
    const id = await endCall();
    navigate(id ? `/w/${brandId}/post/${id}` : `/w/${brandId}/leads`);
  };

  return (
    <div className="livecall">
      {/* Left rail */}
      <div className="console-rail">
        <div className={`live-orb-card rise rise-1 ${agentSpeaking ? "speaking" : ""}`}>
          <div className={`orb ${live ? "active" : ""}`}>
            <span className="orb-ring r1" /><span className="orb-ring r2" /><span className="orb-ring r3" />
            <span className="orb-core"><PhoneCall size={26} /></span>
          </div>
          <div className="orb-state-wrap">
            <div className="orb-timer mono">{elapsed}</div>
            <div className="orb-state">{live ? (agentSpeaking ? "Agent speaking" : "On call") : status || "Connecting…"}</div>
          </div>
        </div>

        <div className="card card-pad rise rise-2">
          <div className="rail-card-head">
            <div className="rail-avatar" style={{ background: accent }}>{initials(lead?.name)}</div>
            <div>
              <div className="rail-name">{lead?.name}</div>
              <div className="rail-phone mono">{lead?.phone}</div>
            </div>
          </div>
          <p className="rail-context">{lead?.profile}</p>
        </div>

        {callConfig?.stanceCue && (
          <div className="card card-pad coach-card rise rise-2">
            <div className="section-label" style={{ marginBottom: 8 }}>You're playing the customer</div>
            <div className="coach-stance">{callConfig.stanceLabel}</div>
            <p className="coach-cue">{callConfig.stanceCue}</p>
          </div>
        )}

        <div className="card card-pad rise rise-3">
          <div className="section-label"><Gauge size={14} /> Telemetry</div>
          <div className="telemetry-grid">
            <div className="metric">
              <span className="metric-label">P50 latency</span>
              <span className={`metric-value ${latencyClass(displayedP50)}`}>
                {displayedP50 != null ? `${displayedP50}` : "—"}
                {displayedP50 != null && <span style={{ fontSize: 12, color: "var(--faint)" }}> ms</span>}
              </span>
              {displayedP50 == null && <span className="metric-sub">{turnCount < 5 ? `${turnCount}/5 turns` : "measuring…"}</span>}
            </div>
            <div className="metric">
              <span className="metric-label">Turns</span>
              <span className="metric-value">{turnCount}</span>
            </div>
            <div className="metric metric-wide mic-row">
              <span className="metric-label"><Mic size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />Your mic</span>
              <MicMeter stream={micStream} />
            </div>
          </div>
          <p className="telemetry-foot">Per-turn latency (speech-end → first audio) is logged to the browser console.</p>
        </div>

        {error && <div className="error-banner"><X size={16} /><span>{error}</span></div>}

        <button className="btn btn-danger btn-block btn-lg" onClick={end} disabled={ending}>
          <X size={18} /> {ending ? "Wrapping up…" : "End call"}
        </button>
      </div>

      {/* Center: transcript */}
      <div className="card transcript-card rise rise-2">
        <div className="transcript-head">
          <div className="section-label"><Activity size={14} /> Live transcript</div>
          <div className="transcript-legend">
            <span className="legend-item"><span className="legend-swatch agent" /> Agent</span>
            <span className="legend-item"><span className="legend-swatch cust" /> Customer</span>
          </div>
        </div>
        <Transcript items={transcript} live />
      </div>

      {/* Right: live qualification (F5) */}
      <div className="qual-rail rise rise-3">
        <div className="card card-pad">
          <div className="section-label"><Target size={14} /> Qualification</div>
          <QualificationRail q={liveQual} live />
        </div>
      </div>
    </div>
  );
}

function latencyClass(ms) {
  if (ms == null) return "";
  if (ms <= 500) return "val-good";
  if (ms <= 800) return "val-warn";
  return "val-bad";
}
