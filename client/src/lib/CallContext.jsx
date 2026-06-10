/**
 * CallContext — the V2 call engine state, lifted out of a single page so it
 * survives navigation across PreCall → LiveCall → PostCall.
 *
 * It owns: the RealtimeSession (V1 transport, unchanged), the live transcript,
 * latency tracker, the live qualification poll (F5), and the client-driven
 * call-end pipeline (persist → summarize → qualify → qa/score) whose results
 * stream into `post` so PostCall panels can render as each lands.
 */
import React, { createContext, useContext, useCallback, useRef, useState } from "react";
import { RealtimeSession } from "./realtime.js";
import { LatencyTracker } from "./latency.js";

const Ctx = createContext(null);
export const useCall = () => useContext(Ctx);

let nextId = 1;

export function CallProvider({ children }) {
  const [phase, setPhase] = useState("idle"); // idle | in-call | post-call
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [micStream, setMicStream] = useState(null);
  const [displayedP50, setDisplayedP50] = useState(null);
  const [turnCount, setTurnCount] = useState(0);
  const [callConfig, setCallConfig] = useState(null); // { brand, lead, languageMode, goalOverride }
  const [liveQual, setLiveQual] = useState(null);
  const [post, setPost] = useState(null);

  const sessionRef = useRef(null);
  const trackerRef = useRef(null);
  const startedAtRef = useRef(null);
  const transcriptRef = useRef([]);
  transcriptRef.current = transcript;
  const custFinalCountRef = useRef(0);
  const qualInFlightRef = useRef(false);
  const configRef = useRef(null);

  /* ── Transcript stream helpers (V1) ──────────────────────────────────── */
  const appendPartial = useCallback((role, delta) => {
    setTranscript((t) => {
      const last = t[t.length - 1];
      if (last && last.role === role && last.partial)
        return [...t.slice(0, -1), { ...last, text: last.text + delta }];
      return [...t, { id: nextId++, role, text: delta, partial: true }];
    });
  }, []);

  const finalize = useCallback((role, fullText) => {
    setTranscript((t) => {
      const last = t[t.length - 1];
      const text = (fullText || last?.text || "").trim();
      if (!text) return last?.partial && last.role === role ? t.slice(0, -1) : t;
      if (last && last.role === role && last.partial)
        return [...t.slice(0, -1), { ...last, text, partial: false }];
      return [...t, { id: nextId++, role, text, partial: false }];
    });
  }, []);

  const snapshot = () =>
    transcriptRef.current
      .filter((t) => !t.partial || t.text.trim())
      .map(({ role, text }) => ({ role, text }));

  /* ── F5: live qualification — every 3rd customer-final, single in flight ─ */
  const maybeQualify = useCallback(() => {
    custFinalCountRef.current += 1;
    if (custFinalCountRef.current % 3 !== 0 || qualInFlightRef.current) return;
    qualInFlightRef.current = true;
    fetch("/api/qualify/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: configRef.current?.brand?.id, transcript: snapshot() }),
    })
      .then((r) => r.json())
      .then((q) => setLiveQual(q))
      .catch(() => {})
      .finally(() => {
        qualInFlightRef.current = false;
      });
  }, []);

  /* ── Start ───────────────────────────────────────────────────────────── */
  const startCall = useCallback(
    async (config) => {
      setError("");
      setTranscript([]);
      setLiveQual(null);
      setDisplayedP50(null);
      setTurnCount(0);
      setPost(null);
      custFinalCountRef.current = 0;
      setCallConfig(config);
      configRef.current = config;

      const tracker = new LatencyTracker();
      trackerRef.current = tracker;

      const session = new RealtimeSession({
        onStatus: setStatus,
        onError: (msg) => setError(msg),
        onCustomerPartial: (d) => appendPartial("customer", d),
        onCustomerFinal: (t) => {
          finalize("customer", t);
          maybeQualify();
        },
        onAgentPartial: (d) => appendPartial("agent", d),
        onAgentFinal: (t) => finalize("agent", t),
        onSpeechStopped: () => tracker.markSpeechStopped(),
        onBargeIn: () => tracker.cancelPending(),
        onAgentAudioStart: () => {
          setAgentSpeaking(true);
          const ms = tracker.markFirstAudio();
          if (ms != null) {
            setTurnCount(tracker.samples.length);
            if (tracker.displayedP50 != null) setDisplayedP50(tracker.displayedP50);
          }
        },
        onAgentAudioStop: () => setAgentSpeaking(false),
        onRemoteStream: () => {},
      });

      sessionRef.current = session;
      setPhase("in-call");
      startedAtRef.current = Date.now();

      try {
        await session.start({
          brandId: config.brand.id,
          leadId: config.lead?.id,
          languageMode: config.languageMode,
          goalOverride: config.goalOverride,
        });
        setMicStream(session.micStream);
      } catch (err) {
        console.error(err);
        session.stop();
        sessionRef.current = null;
        setPhase("idle");
        setError(err.message);
        throw err;
      }
    },
    [appendPartial, finalize, maybeQualify]
  );

  /* ── End → persist, then summarize → qualify → qa (each streams in) ────── */
  const endCall = useCallback(async () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setMicStream(null);
    setAgentSpeaking(false);

    const endedAt = Date.now();
    const durationMs = endedAt - (startedAtRef.current || endedAt);
    const finalTranscript = snapshot();
    const latency = trackerRef.current?.stats() ?? null;
    const cfg = configRef.current;
    const brand = cfg?.brand;

    setPhase("post-call");
    setPost({
      durationMs,
      latency,
      transcript: finalTranscript,
      summary: null,
      disposition: null,
      brief3: null,
      commitments: null,
      qualification: null,
      qa: null,
      callId: null,
    });

    // 1. Persist (need the id before the rest of the pipeline).
    let callId = null;
    try {
      const r = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brand?.id,
          leadId: cfg?.lead?.id || null,
          lead: cfg?.lead || null,
          goal: cfg?.goalOverride || "",
          languageMode: cfg?.languageMode,
          startedAt: new Date(startedAtRef.current).toISOString(),
          endedAt: new Date(endedAt).toISOString(),
          durationMs,
          transcript: finalTranscript,
          latency,
        }),
      });
      ({ id: callId } = await r.json());
      setPost((p) => (p ? { ...p, callId } : p));
    } catch {
      /* leave callId null — panels degrade gracefully */
    }

    // 2. Summarize (extended: brief3 + commitments).
    fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callId,
        transcript: finalTranscript,
        goal: cfg?.goalOverride || "",
        dispositions: brand?.dispositions,
      }),
    })
      .then((r) => r.json())
      .then((d) =>
        setPost((p) =>
          p ? { ...p, summary: d.summary, disposition: d.disposition, brief3: d.brief3, commitments: d.commitments } : p
        )
      )
      .catch(() => setPost((p) => (p ? { ...p, summary: "Summary unavailable.", disposition: "nurture", brief3: [], commitments: [] } : p)));

    // 3. Final qualification.
    if (callId) {
      fetch("/api/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      })
        .then((r) => r.json())
        .then((q) => setPost((p) => (p ? { ...p, qualification: q } : p)))
        .catch(() => {});

      // 4. QA score.
      fetch("/api/qa/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      })
        .then((r) => r.json())
        .then((qa) => setPost((p) => (p ? { ...p, qa } : p)))
        .catch(() => {});
    }

    return callId;
  }, []);

  const reset = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setPhase("idle");
    setTranscript([]);
    setLiveQual(null);
    setPost(null);
    setError("");
    setStatus("");
    setMicStream(null);
  }, []);

  const value = {
    phase, status, error, transcript, agentSpeaking, micStream,
    displayedP50, turnCount, callConfig, liveQual, post,
    startedAt: startedAtRef.current,
    startCall, endCall, reset,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
