import React, { useEffect, useRef } from "react";
import { Activity } from "./icons.jsx";

export default function Transcript({ items, live = false }) {
  const endRef = useRef(null);

  useEffect(() => {
    if (live) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, live]);

  if (items.length === 0) {
    return (
      <div className="transcript transcript-empty">
        <div className="empty-orb"><Activity size={24} /></div>
        <div>
          <div className="empty-title">
            {live ? "Waiting for the agent's opening line…" : "No conversation captured"}
          </div>
          <div className="empty-sub">
            {live
              ? "The agent greets first on an outbound call. Speak when you're ready to reply."
              : "This call ended before any dialogue was exchanged."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="transcript" role="log" aria-live={live ? "polite" : "off"}>
      {items.map((t) => (
        <div key={t.id ?? `${t.role}-${t.text.slice(0, 24)}`} className={`utt utt-${t.role}`}>
          <span className="utt-tag">{t.role === "agent" ? "AGT" : "CUS"}</span>
          <div className="utt-bubble">
            <div className="utt-who">{t.role === "agent" ? "Agent" : "Customer"}</div>
            <span className="utt-text">
              {t.text}
              {t.partial && <span className="utt-caret" aria-hidden="true" />}
            </span>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
