#!/usr/bin/env npx tsx
/**
 * Winners API pilot — CommBank, NAB, Westpac only (max 3 scans).
 *
 * npm run adlibrary:winners-pilot -- --dry-run
 */
import { AdLibraryClient } from "./lib/adlibraryClient.ts";
import { CreditTracker } from "./lib/adlibraryCredits.ts";
import { getSupabaseAdmin } from "./lib/supabaseAdmin.ts";
import { argBool, argNumber, argString, parseArgs } from "./lib/parseArgs.ts";

const PILOT_ADVERTISERS = ["CommBank", "NAB", "Westpac"];
const MIN_CONFIDENCE = 0.75;

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = argBool(args, "dryRun") || !process.env.ADLIBRARY_API_KEY;
  const advertiserFilter = argString(args, "advertiser");
  const topEnrich = argNumber(args, "topEnrich", 50);
  const maxPages = argNumber(args, "maxPages", 5);

  const targets = advertiserFilter
    ? PILOT_ADVERTISERS.filter((a) =>
        a.toLowerCase().includes(advertiserFilter.toLowerCase()),
      )
    : PILOT_ADVERTISERS;

  const tracker = new CreditTracker();
  const client = new AdLibraryClient({ dryRun, creditTracker: tracker });
  const supabase = dryRun ? null : getSupabaseAdmin();

  const stats = {
    advertisersRequested: targets.length,
    winnersFound: 0,
    scansRun: 0,
    skipped: [] as string[],
    topConcepts: [] as unknown[],
    scoreDistribution: {} as Record<string, number>,
    errors: [] as string[],
  };

  for (const name of targets.slice(0, tracker.maxWinnersScans)) {
    try {
      const candidates = await client.searchAdvertisers(name);
      const best = candidates
        .filter((c) => c.meta_page_id)
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];

      if (!best?.meta_page_id || (best.confidence ?? 0) < MIN_CONFIDENCE) {
        stats.skipped.push(`${name}: no confident Meta page ID`);
        continue;
      }

      const pageId = String(best.meta_page_id);
      const concepts = await client.scanWinningAds(pageId);
      stats.scansRun += 1;
      stats.winnersFound += concepts.length;

      const sorted = [...concepts].sort(
        (a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0),
      );

      for (const c of sorted.slice(0, topEnrich)) {
        const tier = String(c.tier ?? "unknown");
        stats.scoreDistribution[tier] = (stats.scoreDistribution[tier] ?? 0) + 1;
      }

      if (stats.topConcepts.length < 5) {
        stats.topConcepts.push(...sorted.slice(0, 3));
      }

      if (supabase && !dryRun) {
        for (const c of sorted.slice(0, maxPages * 10)) {
          await supabase.from("adlibrary_winning_concepts").upsert(
            {
              advertiser_name: name,
              page_id: pageId,
              category: "Banking",
              ad_key: c.ad_key ?? null,
              tier: c.tier ?? null,
              composite_score: c.composite_score ?? null,
              reasons: c.reasons ?? null,
              variant_count: c.variant_count ?? null,
              variants: c.variants ?? null,
              dna_diff: c.dna_diff ?? null,
              tags: c.tags ?? null,
              raw_json: c,
              scanned_at: new Date().toISOString(),
            },
            { onConflict: "advertiser_name,page_id,ad_key" },
          );
        }
      }
    } catch (e) {
      stats.errors.push(`${name}: ${String(e)}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        dryRun,
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
