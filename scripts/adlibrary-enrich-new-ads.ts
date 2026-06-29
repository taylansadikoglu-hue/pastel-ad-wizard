#!/usr/bin/env npx tsx
/**
 * Enrich AdLibrary ads not enriched in the last 30 days.
 *
 * npm run adlibrary:enrich -- --dry-run --category Banking --limit 20
 */
import { AdLibraryClient } from "./lib/adlibraryClient.ts";
import { CreditTracker } from "./lib/adlibraryCredits.ts";
import {
  mergePlacementRow,
  parseEnrichmentTags,
} from "./lib/adlibraryPlacementUpsert.ts";
import { getSupabaseAdmin } from "./lib/supabaseAdmin.ts";
import { argBool, argNumber, argString, parseArgs } from "./lib/parseArgs.ts";

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = argBool(args, "dryRun") || !process.env.ADLIBRARY_API_KEY;
  const categoryFilter = argString(args, "category");
  const advertiserFilter = argString(args, "advertiser");
  const limit = Math.min(
    argNumber(args, "limit", 200),
    Number(process.env.MAX_ADLIBRARY_ENRICHMENTS_PER_RUN ?? 200),
  );

  const tracker = new CreditTracker();
  const client = new AdLibraryClient({ dryRun, creditTracker: tracker });
  const supabase = dryRun ? null : getSupabaseAdmin();

  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();

  let q = supabase
    ? supabase
        .from("ad_placements")
        .select("id, creative_hash, advertiser_name, channel_platform, category, raw, hook_analysis, strategist_takeaway, buyer_stage, emotional_driver, offer_type, primary_cta, product_type, market_signal, offer_signal")
        .eq("source_platform", "adlibrary")
        .limit(limit * 3)
    : null;

  if (q && categoryFilter) q = q.eq("category", categoryFilter);
  if (q && advertiserFilter) q = q.ilike("advertiser_name", `%${advertiserFilter}%`);

  const { data: placements, error } = q
    ? await q
    : dryRun
      ? {
          data: [
            {
              id: 0,
              creative_hash: "adlibrary:dry-CommBank-1",
              advertiser_name: "CommBank",
              channel_platform: "Facebook",
              category: "Banking",
              raw: { ad_key: "dry-CommBank-1", payload: { ad_key: "dry-CommBank-1", advertiser_name: "CommBank" } },
            },
          ],
          error: null,
        }
      : { data: [], error: null };
  if (error) throw new Error(error.message);

  const stats = {
    candidates: placements?.length ?? 0,
    enrichmentCalls: 0,
    cacheHits: 0,
    rowsUpdated: 0,
    errors: [] as string[],
  };

  let processed = 0;

  for (const row of placements ?? []) {
    if (processed >= limit) break;

    const raw = (row.raw ?? {}) as Record<string, unknown>;
    const adKey = String(raw.ad_key ?? "");
    if (!adKey) continue;

    if (supabase && !dryRun) {
      const { data: cached } = await supabase
        .from("adlibrary_enrichments")
        .select("ad_key, expires_at, cached")
        .eq("ad_key", adKey)
        .maybeSingle();

      if (cached?.expires_at && cached.expires_at > new Date().toISOString()) {
        stats.cacheHits += 1;
        continue;
      }
    }

    processed += 1;

    try {
      const enrichment = await client.enrichAd({ ad: raw.payload ?? raw });
      stats.enrichmentCalls += 1;
      if (enrichment.cached) stats.cacheHits += 1;

      const expiresAt = new Date(Date.now() + 30 * 864e5).toISOString();
      const enrichmentRow = {
        ad_key: adKey,
        advertiser_name: row.advertiser_name,
        platform: row.channel_platform,
        summary: enrichment.summary ?? null,
        transcription: enrichment.transcription ?? null,
        analysis: enrichment.analysis ?? null,
        ugc_script: enrichment.ugc_script ?? null,
        markdown: enrichment.markdown ?? null,
        source: enrichment.source ?? "adlibrary",
        cached: enrichment.cached ?? false,
        raw_json: enrichment,
        enriched_at: new Date().toISOString(),
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      };

      if (supabase && !dryRun) {
        await supabase.from("adlibrary_enrichments").upsert(enrichmentRow);

        const tags = parseEnrichmentTags(enrichment);
        const patch = mergePlacementRow(row as Record<string, unknown>, tags);
        if (Object.keys(patch).length) {
          await supabase.from("ad_placements").update(patch).eq("id", row.id);
          stats.rowsUpdated += 1;
        }
      }
    } catch (e) {
      stats.errors.push(`${adKey}: ${String(e)}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        dryRun,
        limit,
        ...stats,
        credits: tracker.summary(),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: String(err) }, null, 2));
  process.exit(1);
});
