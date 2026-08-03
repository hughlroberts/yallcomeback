/**
 * Shared LLM client for pricing agents (xAI Grok preferred, OpenAI-compatible fallback).
 */

export type LlmChatResult = {
  ok: boolean;
  text: string;
  model: string;
  error?: string;
  latencyMs: number;
};

export function pricingLlmConfigured(): boolean {
  return Boolean(
    process.env.XAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim(),
  );
}

export function pricingLlmModel(): string {
  if (process.env.PRICING_INTELLIGENCE_MODEL?.trim()) {
    return process.env.PRICING_INTELLIGENCE_MODEL.trim();
  }
  return process.env.XAI_API_KEY?.trim()
    ? "grok-4-1-fast-non-reasoning"
    : "gpt-4o-mini";
}

export async function pricingLlmChat(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<LlmChatResult> {
  const key =
    process.env.XAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      text: "",
      model: "",
      error: "No XAI_API_KEY / OPENAI_API_KEY",
      latencyMs: 0,
    };
  }

  const isXai = Boolean(process.env.XAI_API_KEY?.trim());
  const baseUrl = isXai
    ? "https://api.x.ai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = pricingLlmModel();
  const started = Date.now();

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1600,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      const t = await res.text();
      return {
        ok: false,
        text: "",
        model,
        error: `HTTP ${res.status}: ${t.slice(0, 300)}`,
        latencyMs,
      };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    return { ok: Boolean(text), text, model, latencyMs };
  } catch (e) {
    return {
      ok: false,
      text: "",
      model,
      error: e instanceof Error ? e.message : "LLM request failed",
      latencyMs: Date.now() - started,
    };
  }
}
