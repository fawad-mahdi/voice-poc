/**
 * OpenAI Realtime WebRTC transport.
 *
 * Flow:
 *   1. POST /api/session (our server)            → ephemeral token ek_...
 *   2. getUserMedia (echoCancellation + noiseSuppression on)
 *   3. RTCPeerConnection: mic track up, remote audio track down,
 *      "oai-events" data channel for control/transcript events
 *   4. POST SDP offer to <baseUrl>?model=... with Bearer ek_... → SDP answer
 *
 * Audio is pure media-track streaming — no audio files, no polling. The data
 * channel carries JSON events: transcripts, VAD markers, audio-buffer
 * lifecycle. Barge-in is handled server-side (interrupt_response: true) and
 * reinforced client-side with an explicit response.cancel.
 */

const SILENCE_PROMPT_MS = 5000;

// Half-duplex: mute the mic while the agent is speaking so laptop speakers
// can't echo back into the mic (needed when demoing without headphones, where
// browser echo cancellation isn't enough). Tradeoff: disables barge-in.
const HALF_DUPLEX = true;

// Which output device the agent's voice plays out of. The browser otherwise
// follows the macOS *default* output (often your headphones). Set this to pin
// the agent audio to a specific device regardless of the system default:
//   "speakers" → built-in MacBook speakers
//   "default"  → follow the system default output
//   any string → match an output device whose label contains it (e.g. "USB")
const PREFERRED_OUTPUT = "speakers";

const OUTPUT_MATCHERS = {
  speakers: /macbook|built-?in|internal|speaker/i,
};

export class RealtimeSession {
  /**
   * @param {object} handlers
   *  onCustomerPartial(text)   live customer transcript delta
   *  onCustomerFinal(text)     finalized customer utterance
   *  onAgentPartial(text)      live agent transcript delta
   *  onAgentFinal(text)        finalized agent utterance
   *  onSpeechStopped()         customer turn ended (latency clock starts)
   *  onAgentAudioStart()       first agent audio at the speaker (latency clock stops)
   *  onAgentAudioStop()        agent finished/was cut off
   *  onBargeIn()               customer interrupted the agent mid-utterance
   *  onStatus(string)          connection status updates
   *  onError(string)
   */
  constructor(handlers) {
    this.h = handlers;
    this.pc = null;
    this.dc = null;
    this.micStream = null;
    this.audioEl = null;
    this.agentSpeaking = false;
    this.silenceTimer = null;
    this.closed = false;
  }

  async start({ brandId, leadId, languageMode = "auto", goalOverride = "" }) {
    this.h.onStatus?.("Requesting session token…");
    const tokenRes = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, leadId, languageMode, goalOverride }),
    });
    if (!tokenRes.ok) {
      const e = await tokenRes.json().catch(() => ({}));
      throw new Error(e.error || `Session endpoint returned ${tokenRes.status}`);
    }
    const session = await tokenRes.json();

    this.h.onStatus?.("Opening microphone…");
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true, // critical: stops the agent hearing itself
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.h.onStatus?.("Connecting (WebRTC)…");
    this.pc = new RTCPeerConnection();

    // Downstream: agent audio streams straight to an <audio> element.
    this.audioEl = document.createElement("audio");
    this.audioEl.autoplay = true;
    await this._routeOutput(); // pin agent voice to the chosen output device
    this.pc.ontrack = (e) => {
      this.audioEl.srcObject = e.streams[0];
      this.h.onRemoteStream?.(e.streams[0]);
    };

    // Upstream: operator/customer microphone.
    for (const track of this.micStream.getTracks()) {
      this.pc.addTrack(track, this.micStream);
    }

    // Control plane.
    this.dc = this.pc.createDataChannel("oai-events");
    this.dc.onmessage = (e) => this._handleEvent(JSON.parse(e.data));
    this.dc.onopen = () => {
      this.h.onStatus?.("Live");
      // Outbound call: the agent greets first. Kick the first response.
      this.send({ type: "response.create" });
    };

    this.pc.onconnectionstatechange = () => {
      if (["failed", "disconnected"].includes(this.pc.connectionState) && !this.closed) {
        this.h.onError?.(`Connection ${this.pc.connectionState}`);
      }
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const sdpRes = await fetch(`${session.baseUrl}?model=${encodeURIComponent(session.model)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });
    if (!sdpRes.ok) {
      throw new Error(`SDP exchange failed: ${sdpRes.status} ${await sdpRes.text()}`);
    }
    await this.pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
  }

  send(event) {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(event));
  }

  /* ── Data-channel event router ─────────────────────────────────────────
   * Handles both GA event names and earlier beta names defensively.      */
  // Route the agent's <audio> element to PREFERRED_OUTPUT via setSinkId.
  // No-op when set to "default" or when the browser lacks setSinkId support.
  async _routeOutput() {
    if (PREFERRED_OUTPUT === "default" || !this.audioEl?.setSinkId) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      const matcher = OUTPUT_MATCHERS[PREFERRED_OUTPUT];
      const pick = outputs.find((d) =>
        matcher ? matcher.test(d.label) : d.label.includes(PREFERRED_OUTPUT),
      );
      if (pick) {
        await this.audioEl.setSinkId(pick.deviceId);
        console.log(`[output] agent audio → "${pick.label}"`);
      } else {
        console.warn(`[output] no output device matched "${PREFERRED_OUTPUT}" — using system default`);
      }
    } catch (err) {
      console.warn("[output] setSinkId failed, using system default:", err);
    }
  }

  _setMicEnabled(on) {
    this.micStream?.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
  }

  _handleEvent(ev) {
    switch (ev.type) {
      /* Customer voice activity (server VAD) */
      case "input_audio_buffer.speech_started":
        this._clearSilenceTimer();
        if (this.agentSpeaking) {
          // Barge-in: server VAD truncates output automatically
          // (interrupt_response: true); cancel defensively too.
          this.send({ type: "response.cancel" });
          this.agentSpeaking = false;
          this.h.onBargeIn?.();
          console.log("[barge-in] customer interrupted — agent audio truncated");
        }
        break;

      case "input_audio_buffer.speech_stopped":
        this.h.onSpeechStopped?.(); // latency clock starts here
        break;

      /* Customer transcript (input transcription stream) */
      case "conversation.item.input_audio_transcription.delta":
        if (ev.delta) this.h.onCustomerPartial?.(ev.delta);
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.h.onCustomerFinal?.(ev.transcript ?? "");
        break;

      /* Agent transcript */
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        if (ev.delta) this.h.onAgentPartial?.(ev.delta);
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        this.h.onAgentFinal?.(ev.transcript ?? "");
        break;

      /* Agent audio lifecycle (WebRTC output buffer) */
      case "output_audio_buffer.started":
        this.agentSpeaking = true;
        if (HALF_DUPLEX) this._setMicEnabled(false); // stop self-hearing
        this._clearSilenceTimer();
        this.h.onAgentAudioStart?.(); // latency clock stops here
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        this.agentSpeaking = false;
        if (HALF_DUPLEX) this._setMicEnabled(true); // customer's turn — reopen mic
        this.h.onAgentAudioStop?.();
        this._armSilenceTimer(); // customer's move — watch for dead air
        break;

      case "error":
        console.error("[realtime] error event:", ev);
        this.h.onError?.(ev.error?.message || "Realtime error");
        break;

      default:
        // Uncomment to inspect the full event firehose:
        // console.debug("[realtime]", ev.type, ev);
        break;
    }
  }

  /* ── Dead-air handling: >5s of silence → "Are you still there?" ──────── */
  _armSilenceTimer() {
    this._clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.closed || this.agentSpeaking) return;
      console.log("[silence] >5s of silence — prompting customer");
      this.send({
        type: "response.create",
        response: {
          instructions:
            'The customer has been silent for over five seconds. Gently check in with a short, natural "Are you still there?" — do not repeat your previous point.',
        },
      });
    }, SILENCE_PROMPT_MS);
  }

  _clearSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  stop() {
    this.closed = true;
    this._clearSilenceTimer();
    try {
      this.dc?.close();
    } catch {}
    try {
      this.pc?.close();
    } catch {}
    this.micStream?.getTracks().forEach((t) => t.stop());
    if (this.audioEl) this.audioEl.srcObject = null;
  }
}
