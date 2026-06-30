#!/usr/bin/env npx tsx
/**
 * Ingest ads for top AdLibrary advertiser candidates into ad_placements.
 *
 * npm run adlibrary:ingest -- --dry-run --category Banking --limit-advertisers 5 --limit-ads 20
 * npm run adlibrary:ingest -- --backfill --advertiser "New Brand"   # 2-year window for new names
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ADLIBRARY_BACKFILL_DAYS, AdLibraryClient, type AdLibraryAd } from "./lib/adlibraryClient.ts";
import { CreditTracker } from "./lib/adlibraryCredits.ts";
import {
  applyEnrichmentToRow,
  mapAdToPlacement,
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

type CategoryConfig = {
  name: string;
  appType: "1" | "2" | "3";
  geo: string;
  platforms: string[];
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
  const forceBackfill = argBool(args, "backfill");
  const noEnrich = argBool(args, "noEnrich");
  const noYoutube = argBool(args, "noYoutube");
  const sortField = argString(args, "sortField") ?? "impression";

  const config = JSON.parse(readFileSync(configPath, "utf8")) as {
    categories: CategoryConfig[];
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
    backfillAdvertisers: 0,
    youtubeAdsFound: 0,
    enrichments: 0,
    errors: [] as string[],
  };

  const seenAdKeys = new Set<string>();
  const knownAdvertisers = await loadKnownAdvertiserNames(supabase, dryRun);

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
      const isNew = !knownAdvertisers.has(normaliseName(cand.advertiser_name));
      const useBackfill = forceBackfill || isNew;
      if (useBackfill) stats.backfillAdvertisers += 1;

      const effectiveDaysBack = useBackfill ? ADLIBRARY_BACKFILL_DAYS : daysBack;
      const dateFrom = useBackfill ? isoDateDaysAgo(ADLIBRARY_BACKFILL_DAYS) : undefined;
      const dateTo = useBackfill ? isoToday() : undefined;

      const socialPlatforms = catCfg.platforms.filter((p) => p !== "youtube");
      const searchPasses: {
        label: string;
        platform?: string | string[];
        adsType?: string[];
      }[] = [
        ...(socialPlatforms.length
          ? [{ label: "multi-platform", platform: socialPlatforms }]
          : []),
        ...(noYoutube ? [] : [{ label: "youtube-video", platform: ["youtube"], adsType: ["2"] }]),
      ];

      for (const pass of searchPasses) {
        try {
          const res = await client.searchAds({
            keyword: cand.advertiser_name,
            appType: catCfg.appType,
            pageSize: Math.min(limitAds, 50),
            geo: catCfg.geo,
            platform: pass.platform,
            adsType: pass.adsType,
            daysBack: dateFrom ? undefined : effectiveDaysBack,
            dateFrom,
            dateTo,
            sortField,
          });

          for (const ad of res.ads) {
            await ingestAd({
              ad,
              cand,
              catName,
              client,
              supabase,
              dryRun,
              noEnrich,
              seenAdKeys,
              stats,
              passLabel: pass.label,
            });
          }
        } catch (e) {
          stats.errors.push(`${cand.advertiser_name}/${pass.label}: ${String(e)}`);
        }
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        dryRun,
        backfillDays: ADLIBRARY_BACKFILL_DAYS,
        ...stats,
        credits: tracker.summary(),
      },
      null,
      2,
    ),
  );
}

async function ingestAd(ctx: {
  ad: AdLibraryAd;
  cand: CandidateRow;
  catName: string;
  client: AdLibraryClient;
  supabase: ReturnType<typeof getSupabaseAdmin> | null;
  dryRun: boolean;
  noEnrich: boolean;
  seenAdKeys: Set<string>;
  stats: {
    adsFound: number;
    inserted: number;
    updated: number;
    skipped: number;
    youtubeAdsFound: number;
    enrichments: number;
    errors: string[];
  };
  passLabel: string;
}): Promise<void> {
  const { ad, cand, catName, client, supabase, dryRun, noEnrich, seenAdKeys, stats, passLabel } = ctx;
  const adKey = String(ad.ad_key ?? "");
  if (adKey && seenAdKeys.has(adKey)) {
    stats.skipped += 1;
    return;
  }
  if (adKey) seenAdKeys.add(adKey);

  stats.adsFound += 1;
  if (passLabel === "youtube-video" || String(ad.platform ?? "").includes("youtube")) {
    stats.youtubeAdsFound += 1;
  }

  const row = mapAdToPlacement({
    ad,
    category: catName,
    domain: cand.domain,
    advertiserName: cand.advertiser_name,
  });

  if (!noEnrich) {
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

async function loadKnownAdvertiserNames(
  supabase: ReturnType<typeof getSupabaseAdmin> | null,
  dryRun: boolean,
): Promise<Set<string>> {
  const names = new Set<string>();
  if (!supabase || dryRun) return names;

  const { data } = await supabase
    .from("adlibrary_advertiser_candidates")
    .select("advertiser_name");

  for (const row of data ?? []) {
    const n = normaliseName((row as { advertiser_name?: string }).advertiser_name ?? "");
    if (n) names.add(n);
  }
  return names;
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

function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: String(err) }, null, 2));
  process.exit(1);
});
