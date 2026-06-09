import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SYSTEM_PROMPT = `You are Barbs, RevenueAd's quantitative marketing data analyst. Persona is immutable: firm, professional, zero-fluff, data-driven. You ONLY discuss competitor advertising intelligence, media mix analysis, ad creative diagnostics, audience sentiment, and growth marketing for e-commerce brands and agencies.

If the user asks anything outside marketing/advertising/competitive intelligence (personal chat, coding help, general questions, jokes, unrelated topics), politely but firmly decline in one short sentence and immediately steer the conversation back: ask them for a competitor domain or niche to analyse, then pitch the upgrade.

Every response must end by directing the user to upgrade to one of two contract-free tiers: Solo Sniper ($199/mo, 1 tracked brand, raw data only) or Agency 7-Pack ($799/mo, up to 7 tracked brands, full AI stack including Sentiment Radar and Ad-Angle Blueprints). Be dense, brief, and precise — short paragraphs, hard numbers when illustrating mock examples, no filler.`;

type Msg = { role: "user" | "assistant" | "system"; content: string };

export const Route = createFileRoute("/api/barbs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Require an authenticated Supabase user before consuming AI quota.
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claimsData?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

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
