#!/usr/bin/env npx tsx
/**
 * Discover top AdLibrary advertiser candidates per category.
 *
 * npm run adlibrary:discover -- --dry-run --category Banking --limit 50
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AdLibraryClient, type AdLibraryAd } from "./lib/adlibraryClient.ts";
import { CreditTracker } from "./lib/adlibraryCredits.ts";
import { getSupabaseAdmin } from "./lib/supabaseAdmin.ts";
import { argBool, argNumber, argString, parseArgs } from "./lib/parseArgs.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config/top-categories.json");

type CategoryConfig = {
  name: string;
  appType: "1" | "2" | "3";
  geo: string;
  platforms: string[];
  searchKeywords: string[];
  seedBrands: { name: string; domain: string }[];
};

type CandidateAgg = {
  category: string;
  advertiser_name: string;
  domain: string | null;
  ad_count: number;
  estimated_impressions: number;
  platforms: Set<string>;
  sample_ads: AdLibraryAd[];
  first_seen: string | null;
  last_seen: string | null;
  confidence: number;
};

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = argBool(args, "dryRun") || !process.env.ADLIBRARY_API_KEY;
  const all = argBool(args, "all");
  const categoryFilter = argString(args, "category");
  const limit = argNumber(args, "limit", 50);

  const config = JSON.parse(readFileSync(configPath, "utf8")) as {
    categories: CategoryConfig[];
  };

  let categories = config.categories;
  if (!all && categoryFilter) {
    categories = categories.filter(
      (c) => c.name.toLowerCase() === categoryFilter.toLowerCase(),
    );
    if (!categories.length) {
      throw new Error(`Unknown category: ${categoryFilter}`);
    }
  }

  const tracker = new CreditTracker();
  const client = new AdLibraryClient({ dryRun, creditTracker: tracker });
  const supabase = dryRun ? null : getSupabaseAdmin();

  const byCategory: Record<string, CandidateAgg[]> = {};
  const errors: string[] = [];

  for (const cat of categories) {
    const agg = new Map<string, CandidateAgg>();

    for (const kw of cat.searchKeywords) {
      try {
        const res = await client.searchAds({
          keyword: kw,
          appType: cat.appType,
          pageSize: 50,
          geo: cat.geo,
          platform: cat.platforms,
          daysBack: 30,
        });

        for (const ad of res.ads) {
          const name = normalizeName(ad.advertiser_name ?? kw);
          if (!name) continue;

          let row = agg.get(name);
          if (!row) {
            const seed = cat.seedBrands.find(
              (s) => s.name.toLowerCase() === name.toLowerCase(),
            );
            row = {
              category: cat.name,
              advertiser_name: name,
              domain: seed?.domain ?? null,
              ad_count: 0,
              estimated_impressions: 0,
              platforms: new Set(),
              sample_ads: [],
              first_seen: null,
              last_seen: null,
              confidence: seed ? 0.9 : 0.6,
            };
            agg.set(name, row);
          }

          row.ad_count += 1;
          row.estimated_impressions += Number(ad.impression ?? 0);
          if (ad.platform) row.platforms.add(String(ad.platform));
          if (row.sample_ads.length < 3) row.sample_ads.push(ad);
          row.first_seen = minIso(row.first_seen, ad.first_seen ?? null);
          row.last_seen = maxIso(row.last_seen, ad.last_seen ?? null);
        }
      } catch (e) {
        errors.push(`${cat.name}/${kw}: ${String(e)}`);
      }
    }

    const ranked = [...agg.values()]
      .sort((a, b) => {
        if (b.ad_count !== a.ad_count) return b.ad_count - a.ad_count;
        if (b.estimated_impressions !== a.estimated_impressions) {
          return b.estimated_impressions - a.estimated_impressions;
        }
        const aRec = a.last_seen ? Date.parse(a.last_seen) : 0;
        const bRec = b.last_seen ? Date.parse(b.last_seen) : 0;
        if (bRec !== aRec) return bRec - aRec;
        return b.platforms.size - a.platforms.size;
      })
      .slice(0, limit);

    byCategory[cat.name] = ranked;

    if (supabase && !dryRun) {
      for (const c of ranked) {
        const payload = {
          category: c.category,
          advertiser_name: c.advertiser_name,
          domain: c.domain,
          platform_ids: null,
          ad_count: c.ad_count,
          estimated_impressions: c.estimated_impressions,
          platforms: [...c.platforms],
          sample_ads: c.sample_ads,
          confidence: c.confidence,
          source: "adlibrary",
          first_seen: c.first_seen,
          last_seen: c.last_seen,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("adlibrary_advertiser_candidates")
          .upsert(payload, { onConflict: "category,advertiser_name" });

        if (error) errors.push(`upsert ${c.advertiser_name}: ${error.message}`);
      }
    }
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    dryRun,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([k, rows]) => [
        k,
        rows.map((r) => ({
          ...r,
          platforms: [...r.platforms],
        })),
      ]),
    ),
    totals: Object.fromEntries(
      Object.entries(byCategory).map(([k, rows]) => [k, rows.length]),
    ),
    credits: tracker.summary(),
    errors,
  };

  const outPath = join(process.cwd(), "tmp/adlibrary-top-candidates.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(artifact, null, 2));

  console.log(JSON.stringify(artifact, null, 2));
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function minIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: String(err) }, null, 2));
  process.exit(1);
});
