/**
 * Per-turn latency tracking.
 *
 * A "turn" latency = time from the customer's speech ending
 * (input_audio_buffer.speech_stopped) to the agent's first audio reaching the
 * speaker (output_audio_buffer.started). This covers STT finalization + LLM
 * first token + TTS time-to-first-audio + network — the spec's
 * "STT end → TTS first-byte" measurement.
 *
 * Every turn is logged to the browser console. The displayed P50 refreshes
 * every 5 turns (per spec) to avoid a jittery readout.
 */
export class LatencyTracker {
  constructor() {
    this.samples = [];
    this._speechStoppedAt = null;
    this.displayedP50 = null; // refreshed every 5 turns
  }

  markSpeechStopped() {
    this._speechStoppedAt = performance.now();
  }

  /** Returns the turn's latency in ms, or null if there was no pending turn. */
  markFirstAudio() {
    if (this._speechStoppedAt == null) return null;
    const ms = Math.round(performance.now() - this._speechStoppedAt);
    this._speechStoppedAt = null;

    // Discard nonsense values (e.g. agent re-prompt after long silence).
    if (ms <= 0 || ms > 15000) return null;

    this.samples.push(ms);
    const p50 = this.p50();

    // Spec deliverable: latency log output in browser console, per turn.
    console.log(
      `%c[latency] turn ${this.samples.length}: speech_end → first_audio = ${ms}ms ` +
        `(running P50 ${p50}ms, P90 ${this.p(90)}ms)`,
      ms <= 800 ? "color:#4AD295" : "color:#FF5D52;font-weight:bold"
    );
    if (ms > 800) {
      console.warn(`[latency] turn ${this.samples.length} exceeded the 800ms budget.`);
    }

    if (this.samples.length % 5 === 0) this.displayedP50 = p50;
    return ms;
  }

  /** Cancels a pending measurement (e.g. customer resumed speaking). */
  cancelPending() {
    this._speechStoppedAt = null;
  }

  p(percentile) {
    if (this.samples.length === 0) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.ceil((percentile / 100) * sorted.length) - 1);
    return sorted[Math.max(0, idx)];
  }

  p50() {
    return this.p(50);
  }

  stats() {
    return {
      turns: this.samples.length,
      p50: this.p50(),
      p90: this.p(90),
      max: this.samples.length ? Math.max(...this.samples) : null,
      samples: [...this.samples],
    };
  }
}
