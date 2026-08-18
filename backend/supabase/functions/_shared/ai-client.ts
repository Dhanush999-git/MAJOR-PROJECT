/**
 * Unified Multi-Provider AI Client for VeriFact Edge Functions
 * Supports:
 * 1. Google Gemini (GEMINI_API_KEY or GOOGLE_API_KEY) — Free Tier supported via Google AI Studio
 * 2. OpenAI ChatGPT (OPENAI_API_KEY)
 * 3. OpenRouter (OPENROUTER_API_KEY)
 */

declare const Deno:
  | {
      env: {
        get(name: string): string | undefined;
      };
    }
  | undefined;

function getEnv(name: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno?.env?.get) {
    return Deno.env.get(name);
  }
  return undefined;
}

export interface AIChatOptions {
  messages: Record<string, unknown>[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  reasoning_effort?: string;
}

export async function callAI(options: AIChatOptions, corsHeaders: Record<string, string>): Promise<Response> {
  const geminiKey = getEnv("GEMINI_API_KEY") || getEnv("GOOGLE_API_KEY");
  const openaiKey = getEnv("OPENAI_API_KEY");
  const openrouterKey = getEnv("OPENROUTER_API_KEY");

  const requestedModel = options.model || "google/gemini-2.5-flash";

  // Provider 1: Google Gemini (OpenAI-compatible endpoint)
  if (geminiKey) {
    const geminiModel = "gemini-3.6-flash";

    const payload: Record<string, unknown> = {
      model: geminiModel,
      messages: options.messages,
    };
    if (options.stream) payload.stream = true;
    if (typeof options.temperature === "number") payload.temperature = options.temperature;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Gemini rate limit reached. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("Gemini API Error:", response.status, errText);
      return new Response(JSON.stringify({ error: `Gemini API error (${response.status}): ${errText}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return response;
  }

  // Provider 2: OpenAI ChatGPT
  if (openaiKey) {
    let openaiModel = "gpt-4o-mini";
    if (requestedModel.includes("pro") || requestedModel.includes("gpt-5") || requestedModel.includes("vision") || requestedModel.includes("image")) {
      openaiModel = "gpt-4o";
    }

    const payload: Record<string, unknown> = {
      model: openaiModel,
      messages: options.messages,
    };
    if (options.stream) payload.stream = true;
    if (typeof options.temperature === "number") payload.temperature = options.temperature;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "OpenAI rate limit reached. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("OpenAI API Error:", response.status, errText);
      return new Response(JSON.stringify({ error: `OpenAI API error (${response.status}): ${errText}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return response;
  }

  // Provider 3: OpenRouter
  if (openrouterKey) {
    let openrouterModel = "google/gemini-2.0-flash-001";
    if (requestedModel.includes("openai")) {
      openrouterModel = "openai/gpt-4o-mini";
    }

    const payload: Record<string, unknown> = {
      model: openrouterModel,
      messages: options.messages,
    };
    if (options.stream) payload.stream = true;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter API Error:", response.status, errText);
      return new Response(JSON.stringify({ error: `OpenRouter API error (${response.status}): ${errText}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return response;
  }

  // Fallback error if no key is configured
  return new Response(
    JSON.stringify({
      error: "No AI API Key configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in your environment variables.",
    }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
