import React from "react";
import { useParams, useNavigate, Outlet, NavLink, useLocation } from "react-router-dom";
import { useFetch } from "../lib/api.js";
import { useCall } from "../lib/CallContext.jsx";
import { themeVars } from "../theme/brandThemes.js";
import { Users, PhoneCall, Lock, ArrowLeft, Sparkle, Activity } from "../components/icons.jsx";

const MARK = { hs: "H&S", deca: "DC", dps: "DPS" };

export default function Workspace() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { phase, status } = useCall();
  const { data: brand, loading, error } = useFetch(`/api/brands/${brandId}`);

  const inCall = phase === "in-call";
  const onLive = location.pathname.includes("/live");

  return (
    <div className="shell workspace" style={themeVars(brandId)} data-brand={brandId}>
      <nav className="sidebar">
        <button className="brand brand-clickable" onClick={() => navigate("/")}>
          <div className="brand-mark">{MARK[brandId] || brandId?.toUpperCase()}</div>
          <div>
            <div className="brand-name">{brand?.name || "…"}</div>
            <div className="brand-tag">{brand?.personaDescriptor || ""}</div>
          </div>
        </button>

        <button className="back-to-command" onClick={() => navigate("/")}>
          <ArrowLeft size={15} /> All workspaces
        </button>

        {inCall && (
          <>
            <div className="nav-group-label">Active</div>
            <NavLink to={`/w/${brandId}/live`} className="nav-item live-nav on">
              <PhoneCall size={19} />
              <span>Live call</span>
              <span className="nav-badge"><span className="dot" /> live</span>
            </NavLink>
          </>
        )}

        <div className="nav-group-label">Workspace</div>
        <NavLink to={`/w/${brandId}/leads`} className={({ isActive }) => `nav-item ${isActive && !inCall ? "on" : ""}`}>
          <Users size={19} />
          <span>Leads</span>
        </NavLink>

        <div className="sidebar-spacer" />

        <div className="sidebar-card">
          <div className="sidebar-card-title"><Lock size={15} /> Isolated context</div>
          <p className="sidebar-card-body">
            This agent's prompt, knowledge and rules are compiled exclusively from this
            workspace at call start. No cross-brand data enters the session.
          </p>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <div className="topbar-titles">
            <span className="topbar-eyebrow">{brand?.name || "Workspace"}</span>
            <span className="topbar-title">{TITLE_FOR(location.pathname)}</span>
          </div>
          <div className="topbar-right">
            <span className="iso-chip" title="This agent's prompt, knowledge and rules are compiled exclusively from this workspace at call start. No cross-brand data enters the session.">
              <Lock size={13} /> Isolated context
            </span>
            {inCall ? (
              <span className="status-pill live"><span className="dot" /> {status === "Live" ? "Live call" : status || "Connecting"}</span>
            ) : phase === "post-call" ? (
              <span className="status-pill"><span className="dot" /> Completed</span>
            ) : (
              <span className="status-pill idle"><span className="dot" /> Ready</span>
            )}
          </div>
        </header>

        <main className="content">
          {loading && <div className="page-loading"><Activity size={20} /> Loading workspace…</div>}
          {error && <div className="error-banner"><span>Couldn't load this workspace ({error}).</span></div>}
          {brand && <Outlet context={{ brand }} />}
        </main>
      </div>
    </div>
  );
}

function TITLE_FOR(path) {
  if (path.includes("/live")) return "Live call";
  if (path.includes("/post")) return "Call summary";
  if (path.includes("/handover")) return "Handover packet";
  if (path.includes("/call/")) return "Pre-call";
  return "Leads";
}
