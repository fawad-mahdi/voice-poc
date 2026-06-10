/**
 * Thin wrapper over the OpenAI chat-completions JSON mode, shared by the
 * summarize / qualify / QA-score endpoints. All three want the same thing: send
 * a system + user prompt, get strict JSON back. Centralised so the model id,
 * error handling and JSON parsing live in one place.
 */
export async function chatJSON({ apiKey, system, user, temperature = 0.2, model }) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || process.env.SUMMARY_MODEL || "gpt-4o-mini",
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return JSON.parse(data.choices[0].message.content);
}

export function transcriptToText(transcript = []) {
  return transcript
    .map((t) => `${t.role === "agent" ? "Agent" : "Customer"}: ${t.text}`)
    .join("\n");
}
