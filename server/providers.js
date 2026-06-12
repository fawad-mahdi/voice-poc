/**
 * Voice provider abstraction.
 *
 * The contract: createSession() returns whatever the CLIENT needs to open a
 * realtime media connection, normalized to:
 *
 *   {
 *     provider:  "openai",
 *     token:     "<short-lived client secret>",
 *     baseUrl:   "<where the client POSTs its SDP offer / opens its socket>",
 *     model:     "<model id>",
 *     expiresAt: <unix seconds | null>
 *   }
 *
 * To add a provider, implement createSession() here and a matching transport
 * in client/src/lib/ (see realtime.js for the OpenAI WebRTC transport).
 * The README's "Swapping voice providers" section walks through this.
 */

const providers = {
  /* ── OpenAI Realtime (GA, speech-to-speech, WebRTC) ─────────────────────
   * STT + LLM + TTS in one session. The server mints an ephemeral client
   * secret via /v1/realtime/client_secrets; the browser then POSTs its SDP
   * offer to /v1/realtime/calls using that token. ~500ms E2E typical.     */
  openai: {
    async createSession({ apiKey, instructions, model, voice, vadSilenceMs }) {
      const body = {
        session: {
          type: "realtime",
          model,
          instructions,
          audio: {
            input: {
              // Live transcription of the CUSTOMER side, streamed back over
              // the data channel so the UI can render it in real time.
              transcription: { model: "gpt-4o-mini-transcribe" },
              // Semantic VAD: a model judges whether the customer actually
              // finished and intends to yield the turn, so backchannels like
              // "ok"/"yeah"/"mhm" no longer truncate the agent or trigger a
              // spurious re-answer. `eagerness: "auto"` lets the API balance
              // responsiveness vs. waiting for the customer to finish.
              turn_detection: {
                type: "semantic_vad",
                eagerness: "auto",
                // Auto-respond when the turn ends — no extra round trip.
                create_response: true,
                // Auto-truncate agent audio when the customer genuinely barges in.
                interrupt_response: true,
              },
              // ── ROLLBACK (previous energy-based VAD) ─────────────────────
              // If semantic_vad misbehaves, delete the block above and restore:
              // turn_detection: {
              //   type: "server_vad",
              //   threshold: 0.5,
              //   prefix_padding_ms: 300,
              //   silence_duration_ms: vadSilenceMs,
              //   create_response: true,
              //   interrupt_response: true,
              // },
            },
            output: { voice },
          },
        },
      };

      const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const text = await r.text();
        throw new Error(`OpenAI client_secrets ${r.status}: ${text.slice(0, 300)}`);
      }
      const data = await r.json();

      return {
        provider: "openai",
        token: data.value, // ek_... ephemeral secret — safe to hand to the browser
        baseUrl: "https://api.openai.com/v1/realtime/calls",
        model,
        expiresAt: data.expires_at ?? null,
      };
    },
  },

  /* ── AssemblyAI + Cartesia / ElevenLabs (chained, optimized) ─────────────
   * Not implemented in the POC. Swap recipe:
   *   STT : AssemblyAI Universal-Streaming WebSocket (~300ms P50 endpoint
   *         detection) → partial transcripts
   *   LLM : stream tokens from your model of choice
   *   TTS : Cartesia Sonic (~90ms TTFA) or ElevenLabs Flash/Turbo WebSocket,
   *         flushing sentence-sized chunks as they arrive
   * Only viable if the three stage latencies sum < 500ms — measure each
   * stage independently before committing. createSession() here would mint
   * the relevant temporary tokens and return socket URLs; the client needs
   * a dedicated transport that pipes mic → STT and TTS → speaker.          */
  assemblyai: {
    async createSession() {
      throw new Error(
        "assemblyai provider is a documented stub — see README 'Swapping voice providers'."
      );
    },
  },
};

export function getProvider(name) {
  const p = providers[name];
  if (!p) throw new Error(`Unknown VOICE_PROVIDER "${name}". Available: ${Object.keys(providers).join(", ")}`);
  return p;
}
