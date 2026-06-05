import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are a Quantitative Data Analyst distilling raw audience commentary about a brand's advertising into three concise, fluff-free, signal-rich blocks.

Return STRICT JSON with three string fields:
- "good": what audiences love, with concrete patterns (no fluff, no marketing speak).
- "friction": what audiences complain about, including drivers of negative sentiment.
- "blueprint": a single ad-angle copy blueprint that exploits "good" and addresses "friction". Punchy, copy-ready.

Each block: 2-3 sentences max. No hedging, no preamble, no emojis.`;

const DomainSchema = z.object({ domain: z.string().min(3).max(255) });

export const startScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DomainSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domain = data.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    // Load this agency's stored API credentials
    const { data: integ } = await supabase
      .from("integrations")
      .select("apify_token, dataforseo_login, dataforseo_password")
      .eq("user_id", userId)
      .maybeSingle();

    const apifyToken = integ?.apify_token ?? process.env.APIFY_API_TOKEN ?? null;
    const dfsLogin = integ?.dataforseo_login ?? process.env.DATAFORSEO_LOGIN ?? null;
    const dfsPass = integ?.dataforseo_password ?? process.env.DATAFORSEO_PASSWORD ?? null;

    // Create scan row
    const { data: scan, error: scanErr } = await supabase
      .from("domain_scans")
      .insert({ user_id: userId, domain, status: "running" })
      .select("id")
      .single();
    if (scanErr || !scan) throw new Error(scanErr?.message ?? "Failed to create scan");
    const scanId = scan.id;

    // Fire async background work — don't await
    (async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const commentBuffer: string[] = [];
      type Placement = { channel: string; hook: string; creative_url?: string; days_running?: number; raw: unknown };
      const placements: Placement[] = [];

      // ---------- Apify: Facebook Ads Library ----------
      if (apifyToken) {
        try {
          const url = `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=120`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              urls: [{ url: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=${encodeURIComponent(domain)}` }],
              count: 25,
              "scrapePageAds.activeStatus": "all",
            }),
          });
          if (res.ok) {
            const items = (await res.json()) as Array<Record<string, unknown>>;
            for (const it of items.slice(0, 50)) {
              const text = String((it as Record<string, string>).ad_creative_body ?? (it as Record<string, string>).snapshot ?? "").trim();
              if (text) commentBuffer.push(text);
              placements.push({
                channel: "Meta",
                hook: text.slice(0, 200) || "(no copy)",
                creative_url: (it as Record<string, string>).ad_snapshot_url ?? undefined,
                days_running: typeof it.days_running === "number" ? (it.days_running as number) : undefined,
                raw: it,
              });
            }
          } else {
            console.warn(`Apify ${res.status}`, await res.text().catch(() => ""));
          }
        } catch (e) {
          console.error("Apify failed", e);
        }
      }

      // ---------- DataForSEO: Google Ads search ----------
      if (dfsLogin && dfsPass) {
        try {
          const basic = Buffer.from(`${dfsLogin}:${dfsPass}`).toString("base64");
          const res = await fetch("https://api.dataforseo.com/v3/serp/google/ads_search/live/advanced", {
            method: "POST",
            headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
            body: JSON.stringify([{ keyword: domain, location_code: 2840, language_code: "en", depth: 20 }]),
          });
          if (res.ok) {
            const json = (await res.json()) as { tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }> };
            const items = json.tasks?.[0]?.result?.[0]?.items ?? [];
            for (const it of items.slice(0, 30)) {
              const text = String(it.title ?? it.description ?? "").trim();
              if (text) commentBuffer.push(text);
              placements.push({
                channel: "Google",
                hook: text.slice(0, 200),
                creative_url: typeof it.url === "string" ? it.url : undefined,
                raw: it,
              });
            }
          } else {
            console.warn(`DataForSEO ${res.status}`, await res.text().catch(() => ""));
          }
        } catch (e) {
          console.error("DataForSEO failed", e);
        }
      }

      // Insert placements
      if (placements.length) {
        await supabaseAdmin.from("ad_placements").insert(
          placements.map((p) => ({ user_id: userId, scan_id: scanId, domain, ...p }))
        );
      }

      // ---------- Lovable AI Gateway: gpt-4o-mini distillation ----------
      let good = "No commentary available yet.";
      let friction = "No friction signals captured yet.";
      let blueprint = `Lead with the strongest proof point you have for ${domain} and address the most common objection in one line.`;
      const model = "openai/gpt-4o-mini";

      if (commentBuffer.length) {
        try {
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
          const sample = commentBuffer.slice(0, 80).join("\n---\n").slice(0, 12000);
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Lovable-API-Key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Brand domain: ${domain}\n\nRaw audience + ad commentary:\n${sample}\n\nReturn JSON only.` },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (aiRes.ok) {
            const j = (await aiRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
            const content = j.choices?.[0]?.message?.content ?? "{}";
            const parsed = JSON.parse(content) as { good?: string; friction?: string; blueprint?: string };
            if (parsed.good) good = parsed.good;
            if (parsed.friction) friction = parsed.friction;
            if (parsed.blueprint) blueprint = parsed.blueprint;
          } else {
            console.warn(`Lovable AI ${aiRes.status}`, await aiRes.text().catch(() => ""));
          }
        } catch (e) {
          console.error("AI distill failed", e);
        }
      }

      await supabaseAdmin.from("sentiment_insights").insert({
        user_id: userId,
        scan_id: scanId,
        domain,
        good,
        friction,
        blueprint,
        model,
      });

      await supabaseAdmin
        .from("domain_scans")
        .update({ status: "done" })
        .eq("id", scanId);
    })().catch(async (err) => {
      console.error("Scan pipeline failed", err);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("domain_scans")
        .update({ status: "error", error: String(err).slice(0, 500) })
        .eq("id", scanId);
    });

    return { scan_id: scanId, domain, status: "running" as const };
  });
