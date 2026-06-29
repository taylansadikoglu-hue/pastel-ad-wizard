#!/usr/bin/env npx tsx
/**
 * Ingest ads for top AdLibrary advertiser candidates into ad_placements.
 *
 * npm run adlibrary:ingest -- --dry-run --category Banking --limit-advertisers 5 --limit-ads 20
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AdLibraryClient } from "./lib/adlibraryClient.ts";
import { CreditTracker } from "./lib/adlibraryCredits.ts";
import {
  mapAdToPlacement,
  parseEnrichmentTags,
  upsertAdlibraryPlacement,
} from "./lib/adlibraryPlacementUpsert.ts";
import { getSupabaseAdmin } from "./lib/supabaseAdmin.ts";
import { argBool, argNumber, argString, parseArgs } from "./lib/parseArgs.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config/top-categories.json");

type CandidateRow = {
  category: string;
  advertiser_name: string;
  domain: string | null;
};

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = argBool(args, "dryRun") || !process.env.ADLIBRARY_API_KEY;
  const all = argBool(args, "all");
  const categoryFilter = argString(args, "category");
  const advertiserFilter = argString(args, "advertiser");
  const limitAdvertisers = argNumber(args, "limitAdvertisers", 50);
  const limitAds = argNumber(args, "limitAds", 50);
  const daysBack = argNumber(args, "daysBack", 30);
  const noEnrich = argBool(args, "noEnrich");

  const config = JSON.parse(readFileSync(configPath, "utf8")) as {
    categories: { name: string; appType: "1" | "2" | "3"; geo: string; platforms: string[] }[];
  };

  const tracker = new CreditTracker();
  const client = new AdLibraryClient({ dryRun, creditTracker: tracker });
  const supabase = dryRun ? null : getSupabaseAdmin();

  let categories = config.categories.map((c) => c.name);
  if (!all && categoryFilter) {
    categories = categories.filter((c) => c.toLowerCase() === categoryFilter.toLowerCase());
  }

  const stats = {
    adsFound: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    advertisersScanned: 0,
    enrichments: 0,
    errors: [] as string[],
  };

  const seenAdKeys = new Set<string>();

  for (const catName of categories) {
    const catCfg = config.categories.find((c) => c.name === catName);
    if (!catCfg) continue;

    const candidates = await loadCandidates(
      supabase,
      catName,
      advertiserFilter,
      limitAdvertisers,
      dryRun,
    );

    for (const cand of candidates) {
      stats.advertisersScanned += 1;
      try {
        const res = await client.searchAds({
          keyword: cand.advertiser_name,
          appType: catCfg.appType,
          pageSize: Math.min(limitAds, 50),
          geo: catCfg.geo,
          platform: catCfg.platforms,
          daysBack,
        });

        for (const ad of res.ads) {
          const adKey = String(ad.ad_key ?? "");
          if (adKey && seenAdKeys.has(adKey)) {
            stats.skipped += 1;
            continue;
          }
          if (adKey) seenAdKeys.add(adKey);

          stats.adsFound += 1;
          const row = mapAdToPlacement({
            ad,
            category: catName,
            domain: cand.domain,
            advertiserName: cand.advertiser_name,
          });

          if (!noEnrich && !dryRun && supabase) {
            try {
              const enrichment = await client.enrichAd({ ad });
              stats.enrichments += 1;
              applyEnrichmentToRow(row, enrichment);
            } catch (e) {
              stats.errors.push(`enrich ${adKey}: ${String(e)}`);
            }
          }

          const result = await upsertAdlibraryPlacement(supabase, row, dryRun);
          if (result === "inserted") stats.inserted += 1;
          else if (result === "updated") stats.updated += 1;
          else stats.skipped += 1;
        }
      } catch (e) {
        stats.errors.push(`${cand.advertiser_name}: ${String(e)}`);
      }
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

async function loadCandidates(
  supabase: ReturnType<typeof getSupabaseAdmin> | null,
  category: string,
  advertiserFilter: string | undefined,
  limit: number,
  dryRun: boolean,
): Promise<CandidateRow[]> {
  if (supabase && !dryRun) {
    let q = supabase
      .from("adlibrary_advertiser_candidates")
      .select("category, advertiser_name, domain")
      .eq("category", category)
      .order("ad_count", { ascending: false })
      .limit(limit);

    if (advertiserFilter) {
      q = q.ilike("advertiser_name", `%${advertiserFilter}%`);
    }

    const { data, error } = await q;
    if (!error && data?.length) return data as CandidateRow[];
  }

  // Fallback: seed from config
  const config = JSON.parse(readFileSync(configPath, "utf8")) as {
    categories: {
      name: string;
      seedBrands: { name: string; domain: string }[];
    }[];
  };
  const cat = config.categories.find((c) => c.name === category);
  if (!cat) return [];

  let seeds = cat.seedBrands.map((s) => ({
    category,
    advertiser_name: s.name,
    domain: s.domain,
  }));

  if (advertiserFilter) {
    seeds = seeds.filter((s) =>
      s.advertiser_name.toLowerCase().includes(advertiserFilter.toLowerCase()),
    );
  }

  return seeds.slice(0, limit);
}

function applyEnrichmentToRow(
  row: Record<string, unknown>,
  enrichment: Record<string, unknown>,
): void {
  const tags = parseEnrichmentTags({
    summary: enrichment.summary as string | null,
    analysis: enrichment.analysis as string | null,
    markdown: enrichment.markdown as string | null,
  });

  for (const [k, v] of Object.entries(tags)) {
    if (v) row[k] = v;
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: String(err) }, null, 2));
  process.exit(1);
});
