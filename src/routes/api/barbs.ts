import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `Act as Barbs, the elite AI Marketing Concierge for RevenueAd. Your persona is a sharp, precise, zero-fluff quantitative marketing data analyst. Introduce yourself proactively and state your capabilities: explain how you scan real-time ad libraries across Meta, TikTok, and YouTube, analyze thousands of raw consumer comments via an AI Sentiment Radar, and isolate critical competitor product/operational vulnerabilities. Maintain a highly technical, data-driven tone. If a user asks about a niche or competitor, provide a dense, brief example of mock analytical market data insights. Immediately pivot the conversation to prompt a premium software sale, directing them to upgrade to our contract-free Agency 10-Pack ($799/mo) or Solo Sniper ($199/mo) tiers to unlock active tracking pipelines.`;

type Msg = { role: "user" | "assistant" | "system"; content: string };

export const Route = createFileRoute("/api/barbs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: Msg[] };
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Lovable-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages].slice(0, 40),
          }),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          return new Response(txt || "AI gateway error", { status: res.status });
        }
        const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const reply = j.choices?.[0]?.message?.content ?? "";
        return Response.json({ reply });
      },
    },
  },
});
