import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are a Quantitative Data Analyst. You receive two distinct corpora about a competitor brand:

1. AD COPY — text scraped from the brand's live paid placements (Meta Ads Library + Google Ads).
2. CONSUMER COMMENTS — real user comments and engagement scraped from the brand's social posts (Facebook/Instagram).

Return STRICT JSON with three string fields:
- "good": analyze the CONSUMER COMMENTS — what real users praise, love, or repeatedly call out as a strength. Cite recurring themes.
- "friction": analyze the CONSUMER COMMENTS — the concrete pain points, complaints, objections, or frustrations users voice in their own words.
- "blueprint": analyze the AD COPY only — distill the competitor's core marketing hook into one punchy, copy-ready ad angle that captures their dominant message.

Each block: 2-3 sentences max. No hedging, no preamble, no emojis. If a corpus is empty, say so explicitly in that field.`;

const COUNTRY_NAMES = ["United States", "Australia", "United Kingdom", "Canada"] as const;
const DomainSchema = z.object({
  domain: z.string().min(3).max(255),
  country: z.enum(COUNTRY_NAMES).optional().default("United States"),
});

export const startScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DomainSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domain = data.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const countryVariable: string = data.country ?? "United States";

    const { data: integ } = await supabase
      .from("integrations")
      .select("apify_token, dataforseo_login, dataforseo_password")
      .eq("user_id", userId)
      .maybeSingle();

    const apifyToken = integ?.apify_token?.trim() || process.env.APIFY_API_TOKEN || null;
    const dfsLogin = integ?.dataforseo_login?.trim() || process.env.DATAFORSEO_LOGIN || null;
    const dfsPass = integ?.dataforseo_password?.trim() || process.env.DATAFORSEO_PASSWORD || null;

    const { data: scan, error: scanErr } = await supabase
      .from("domain_scans")
      .insert({ user_id: userId, domain, status: "running" })
      .select("id")
      .single();
    if (scanErr || !scan) throw new Error(scanErr?.message ?? "Failed to create scan");
    const scanId = scan.id;

    const pipeline = (async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const adCopyBuffer: string[] = [];
      const commentBuffer: string[] = [];
      type Placement = { channel: string; hook: string; creative_url?: string; days_running?: number; raw: unknown };
      const placements: Placement[] = [];

      // ---------- Apify: Facebook Ads Library (ad copy + creatives) ----------
      if (apifyToken) {
        try {
          const advertiserName = domain.replace(/^www\./, "").split(".")[0]?.trim();
          if (!advertiserName) throw new Error("Empty advertiser/page name for Apify ads scrape");
          const url = `https://api.apify.com/v2/acts/curious_coder~facebook-ads-library-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=120`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              urls: [{ url: `https://www.facebook.com/${encodeURIComponent(advertiserName)}` }],
              max_results: 15,
              limitPerSource: 15,
              count: 15,
              "scrapePageAds.activeStatus": "all",
              "scrapePageAds.countryCode": "US",
            }),
          });
          if (res.ok) {
            const items = (await res.json()) as Array<Record<string, unknown>>;
            for (const it of items.slice(0, 50)) {
              const text = String((it as Record<string, string>).ad_creative_body ?? (it as Record<string, string>).snapshot ?? "").trim();
              if (text) adCopyBuffer.push(text);
              placements.push({
                channel: "Meta",
                hook: text.slice(0, 200) || "(no copy)",
                creative_url: (it as Record<string, string>).ad_snapshot_url ?? undefined,
                days_running: typeof it.days_running === "number" ? (it.days_running as number) : undefined,
                raw: it,
              });
            }
          } else {
            console.warn(`Apify ads ${res.status}`, await res.text().catch(() => ""));
          }
        } catch (e) {
          console.error("Apify ads scraper failed", e);
        }

        // ---------- Apify: Social comment scraper (Instagram + Facebook posts/comments) ----------
        try {
          const handle = domain.split(".")[0];
          const url = `https://api.apify.com/v2/acts/apify~instagram-comment-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=120`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              directUrls: [`https://www.instagram.com/${handle}/`],
              resultsLimit: 100,
              isNewestComments: true,
            }),
          });
          if (res.ok) {
            const items = (await res.json()) as Array<Record<string, unknown>>;
            for (const it of items.slice(0, 200)) {
              const text = String(it.text ?? it.comment ?? "").trim();
              if (text) commentBuffer.push(text);
            }
            console.log(`Social listening: pulled ${commentBuffer.length} comments for ${handle}`);
          } else {
            console.error("Apify comment scraper HTTP error", res.status, await res.text().catch(() => ""));
          }
        } catch (e) {
          console.error("Apify comment scraper failed", e);
        }
      } else {
        console.error("Apify scrapers skipped: missing apify_token credential");
      }

      // ---------- DataForSEO: Google Ads search ----------
      if (dfsLogin && dfsPass) {
        try {
          const basic = Buffer.from(`${dfsLogin}:${dfsPass}`, "utf-8").toString("base64");
          // Trace + clean the competitor domain variable before sending to DataForSEO.
          // The endpoint rejects raw URLs / TLDs in the `keyword` field, so strip
          // protocol, path, www., and TLD chunks down to the bare brand token.
          let domainVariable = (domain ?? "").toString().trim().toLowerCase();
          domainVariable = domainVariable.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
          const brandToken = domainVariable.split(".")[0]?.trim() ?? "";
          domainVariable = brandToken;
          if (!domainVariable) {
            console.error("DataForSEO request skipped: empty keyword/domain", { rawDomain: domain });
            throw new Error("Empty keyword for DataForSEO");
          }
          console.log("DataForSEO Payload:", { keyword: domainVariable, location: countryVariable });
          const bodyStr = JSON.stringify([{ target: domainVariable }]);
          console.log("DataForSEO request prepared", {
            loginPrefix: dfsLogin.slice(0, 3),
            basicLen: basic.length,
            keyword: domainVariable,
            bodyPreview: bodyStr.slice(0, 200),
          });
          const res = await fetch("https://api.dataforseo.com/v3/serp/google/ads_search/live/advanced", {
            method: "POST",
            headers: {
              Authorization: `Basic ${basic}`,
              "Content-Type": "application/json",
            },
            body: bodyStr,
          });
          if (res.ok) {
            const json = (await res.json()) as { status_code?: number; status_message?: string; tasks?: Array<{ status_code?: number; status_message?: string; result?: Array<{ items?: Array<Record<string, unknown>> }> }> };
            const task = json.tasks?.[0];
            if ((json.status_code && json.status_code >= 40000) || (task?.status_code && task.status_code >= 40000)) {
              console.error("DataForSEO API error", {
                statusCode: json.status_code,
                statusMessage: json.status_message,
                taskStatusCode: task?.status_code,
                taskStatusMessage: task?.status_message,
              });
            }
            const items = json.tasks?.[0]?.result?.[0]?.items ?? [];
            for (const it of items.slice(0, 30)) {
              const text = String(it.title ?? it.description ?? "").trim();
              if (text) adCopyBuffer.push(text);
              placements.push({
                channel: "Google",
                hook: text.slice(0, 200),
                creative_url: typeof it.url === "string" ? it.url : undefined,
                raw: it,
              });
            }
          } else {
            const body = await res.text().catch(() => "");
            console.error("DataForSEO HTTP request failed", { status: res.status, body: body.slice(0, 500) });
          }
        } catch (e) {
          console.error("DataForSEO request failed", e);
        }
      } else {
        console.error("DataForSEO request skipped: missing login or password credential");
      }

      if (placements.length) {
        await supabaseAdmin.from("ad_placements").insert(
          placements.map((p) => ({ user_id: userId, scan_id: scanId, domain, channel: p.channel, hook: p.hook, creative_url: p.creative_url, days_running: p.days_running, raw: p.raw as never }))
        );
      }

      // ---------- Lovable AI Gateway: gpt-4o-mini distillation ----------
      let good = "No consumer comments captured yet.";
      let friction = "No consumer comments captured yet.";
      let blueprint = `No ad copy captured yet for ${domain}.`;
      const model = "openai/gpt-4o-mini";

      if (adCopyBuffer.length || commentBuffer.length) {
        try {
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
          const adSample = adCopyBuffer.slice(0, 60).join("\n---\n").slice(0, 6000);
          const commentSample = commentBuffer.slice(0, 120).join("\n---\n").slice(0, 6000);
          const userMsg = `Brand domain: ${domain}\n\n=== AD COPY ===\n${adSample || "(none)"}\n\n=== CONSUMER COMMENTS ===\n${commentSample || "(none)"}\n\nReturn JSON only.`;
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
                { role: "user", content: userMsg },
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
    })();

    try {
      await pipeline;
    } catch (err) {
      console.error("Scan pipeline failed", err);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("domain_scans")
        .update({ status: "error", error: String(err).slice(0, 500) })
        .eq("id", scanId);
      return { scan_id: scanId, domain, status: "error" as const };
    }

    return { scan_id: scanId, domain, status: "done" as const };
  });
