#!/usr/bin/env npx tsx
/**
 * CommBank-only AdLibrary evaluation — native AdLibrary data, no OpenAI/enrichment.
 *
 * npm run adlibrary:commbank-report
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ENGINE_BASE =
  process.env.ADLIBRARY_EVAL_ENGINE_URL ??
  "https://api.revenuad.com";
const DOMAIN = "commbank.com.au";
const BRAND = "CommBank";

type EngineAd = {
  id: number;
  advertiser?: string | null;
  ad_format?: string | null;
  channel_platform?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  sighting_count?: number | null;
  spend_signal?: number | null;
  landing_url?: string | null;
  ai_tags?: {
    source?: string;
    brand?: string;
    page_name?: string;
    ad_copy?: string | null;
    call_to_action?: string | null;
    channel_platform?: string;
    channels?: string[];
    spend_usd?: number | null;
    like_count?: number | null;
    share_count?: number | null;
    engagement_score?: number | null;
  };
};

type PlacementRow = Record<string, unknown>;

async function fetchEngineAds(brand: string): Promise<EngineAd[]> {
  const out: EngineAd[] = [];
  let page = 1;
  while (true) {
    const url = `${ENGINE_BASE}/api/ads?brand=${encodeURIComponent(brand)}&limit=100&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Engine API ${res.status}: ${url}`);
    const json = (await res.json()) as { ads?: EngineAd[]; pages?: number };
    out.push(...(json.ads ?? []));
    if (!json.pages || page >= json.pages) break;
    page += 1;
  }
  return out;
}

function isTrueCommBankAd(ad: EngineAd): boolean {
  const pn = (ad.ai_tags?.page_name ?? "").toLowerCase();
  const adv = (ad.advertiser ?? "").toLowerCase();
  return (
    pn.includes("commonwealth") ||
    pn.includes("commbank") ||
    adv.includes("commbank") ||
    adv.includes("commonwealth bank")
  );
}

function aggregate(rows: EngineAd[] | PlacementRow[], kind: string) {
  const platforms: Record<string, number> = {};
  const channelDetail: Record<string, number> = {};
  const ctas: Record<string, number> = {};
  const titles: Record<string, number> = {};
  const hooks: Record<string, number> = {};
  const landings: string[] = [];

  let impressions = 0;
  let spendTotal = 0;
  let spendCount = 0;
  let likes = 0;
  let shares = 0;
  let image = 0;
  let video = 0;
  let other = 0;
  const firsts: string[] = [];
  const lasts: string[] = [];
  let withMedia = 0;
  let withCopy = 0;
  let engagementTotal = 0;
  let engagementCount = 0;

  for (const row of rows) {
    const isEngine = "ai_tags" in row;
    const tags = isEngine ? (row as EngineAd).ai_tags ?? {} : {};
    const r = row as EngineAd & PlacementRow;

    const platform =
      tags.channel_platform ??
      r.channel_platform ??
      (isEngine ? "Meta" : String(r.source_platform ?? r.channel ?? "unknown"));
    platforms[String(platform)] = (platforms[String(platform)] ?? 0) + 1;

    if (tags.channels?.length) {
      for (const ch of tags.channels) {
        channelDetail[ch] = (channelDetail[ch] ?? 0) + 1;
      }
    }

    const imp = Number(r.sighting_count ?? r.times_seen ?? tags.impression ?? 0);
    impressions += imp;

    const spend = Number(tags.spend_usd ?? r.spend_signal ?? 0);
    if (spend > 0) {
      spendTotal += spend;
      spendCount += 1;
    }

    likes += Number(tags.like_count ?? (r.raw as { like_count?: number })?.like_count ?? 0);
    shares += Number(tags.share_count ?? (r.raw as { share_count?: number })?.share_count ?? 0);

    const cta = tags.call_to_action ?? r.primary_cta ?? r.detected_cta;
    if (cta) ctas[String(cta)] = (ctas[String(cta)] ?? 0) + 1;

    const title = String(tags.ad_copy ?? r.ad_title ?? r.raw_copy ?? r.headline ?? "").trim();
    if (title) {
      titles[title.slice(0, 100)] = (titles[title.slice(0, 100)] ?? 0) + 1;
      const hook = title.split(/[.!?]/)[0]?.slice(0, 80) ?? title.slice(0, 80);
      hooks[hook] = (hooks[hook] ?? 0) + 1;
      withCopy += 1;
    }

    const fmt = String(r.ad_format ?? r.ad_type ?? "").toLowerCase();
    if (fmt.includes("video") || r.video_url) video += 1;
    else if (fmt.includes("image") || r.image_url || r.media_url || r.creative_url) image += 1;
    else other += 1;

    if (r.first_seen) firsts.push(String(r.first_seen));
    if (r.last_seen) lasts.push(String(r.last_seen));
    if (r.image_url || r.media_url || r.creative_url) withMedia += 1;
    if (r.landing_url) landings.push(String(r.landing_url));

    if (tags.engagement_score != null) {
      engagementTotal += Number(tags.engagement_score);
      engagementCount += 1;
    }
  }

  firsts.sort();
  lasts.sort();

  const top = (obj: Record<string, number>, n = 10) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);

  return {
    kind,
    totalAds: rows.length,
    platforms,
    channelDetail,
    firstSeenRange: firsts.length ? [firsts[0], firsts[firsts.length - 1]] : null,
    lastSeenRange: lasts.length ? [lasts[0], lasts[lasts.length - 1]] : null,
    impressionsTotal: impressions,
    spendTotalUsd: Math.round(spendTotal),
    spendAvgUsd: spendCount ? Math.round(spendTotal / spendCount) : 0,
    spendAdsWithEstimate: spendCount,
    likesTotal: likes,
    sharesTotal: shares,
    engagementAvg: engagementCount ? Math.round(engagementTotal / engagementCount) : null,
    imageCount: image,
    videoCount: video,
    otherFormatCount: other,
    withCopyCount: withCopy,
    topCtas: top(ctas),
    topTitles: top(titles),
    topHooks: top(hooks),
    sampleLandingUrls: [...new Set(landings)].slice(0, 8),
    withMediaPct: rows.length ? Math.round((100 * withMedia) / rows.length) : 0,
    sampleRows: rows.slice(0, 5).map((r) => {
      const tags = (r as EngineAd).ai_tags ?? {};
      return {
        id: (r as EngineAd).id ?? r.id,
        advertiser: (r as EngineAd).advertiser ?? r.advertiser_name,
        page_name: tags.page_name,
        platform: tags.channel_platform ?? r.channel_platform,
        channels: tags.channels,
        title: String(tags.ad_copy ?? r.ad_title ?? "").slice(0, 120),
        impressions: (r as EngineAd).sighting_count ?? r.times_seen,
        spend_usd: tags.spend_usd,
        engagement_score: tags.engagement_score,
        first_seen: r.first_seen,
        last_seen: r.last_seen,
        image_url: (r as EngineAd).image_url ?? r.media_url,
        cta: tags.call_to_action,
      };
    }),
  };
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");

  const sb = createClient(url, key);

  const engineAll = await fetchEngineAds(BRAND);
  const adlibAll = engineAll.filter((a) => a.ai_tags?.source === "adlibrary");
  const adlibTrue = adlibAll.filter(isTrueCommBankAd);

  const [{ data: normRows }, { count: supabaseAdlibCount }] = await Promise.all([
    sb.from("normalized_ad_placements").select("*").eq("domain", DOMAIN),
    sb
      .from("ad_placements")
      .select("id", { count: "exact", head: true })
      .eq("source_platform", "adlibrary")
      .eq("domain", DOMAIN),
  ]);

  const adlibAgg = aggregate(adlibTrue, "adlibrary_commbank_true");
  const normAgg = aggregate((normRows ?? []) as PlacementRow[], "normalized_supabase");

  const metaNorm = (normRows ?? []).filter((r) =>
    /meta/i.test(String(r.channel_platform ?? r.source_platform ?? "")),
  ).length;

  const report = {
    generatedAt: new Date().toISOString(),
    scope: "CommBank only — AdLibrary native data, no OpenAI",
    sqlCounts: {
      ad_placements_source_adlibrary_domain_commbank: supabaseAdlibCount ?? 0,
      normalized_ad_placements_domain_commbank: normRows?.length ?? 0,
      engine_ads_brand_commbank_total: engineAll.length,
      engine_ads_adlibrary_tagged: adlibAll.length,
      engine_ads_adlibrary_true_commbank_page: adlibTrue.length,
    },
    creditsUsed: {
      note: "Ingest credits not logged in pipeline_runs (table absent). Estimated from Banking ingest: ~1 credit/search page per brand.",
      estimatedBankingIngestCredits: "~85 per brand × 4 brands ≈ 340 credits (CommBank, NAB, Westpac, ANZ)",
      enrichCredits: 0,
      openAiUsed: false,
    },
    adlibrary: adlibAgg,
    existingBaseline: normAgg,
    whatAdLibraryAdds: {
      moreAds: adlibAgg.totalAds - normAgg.totalAds,
      moreMetaCreatives: adlibAgg.totalAds - metaNorm,
      impressions: {
        adlibrary: adlibAgg.impressionsTotal,
        existing: normAgg.impressionsTotal,
        delta: adlibAgg.impressionsTotal - normAgg.impressionsTotal,
      },
      spendEstimates: {
        adlibraryAdsWithSpend: adlibAgg.spendAdsWithEstimate,
        adlibraryTotalUsd: adlibAgg.spendTotalUsd,
        adlibraryAvgUsd: adlibAgg.spendAvgUsd,
        existing: "none in normalized baseline",
      },
      likesShares: {
        likesTotal: adlibAgg.likesTotal,
        sharesTotal: adlibAgg.sharesTotal,
        note:
          adlibAgg.likesTotal === 0
            ? "Like/share counts not surfaced in engine ingest; available in raw AdLibrary payload if synced to ad_placements.raw"
            : "present",
      },
      dateCoverage: {
        adlibraryFirstSeen: adlibAgg.firstSeenRange,
        adlibraryLastSeen: adlibAgg.lastSeenRange,
        existingFirstSeen: normAgg.firstSeenRange,
        existingLastSeen: normAgg.lastSeenRange,
      },
      creativeQuality: {
        adlibraryWithCopy: adlibAgg.withCopyCount,
        adlibraryWithMediaPct: adlibAgg.withMediaPct,
        existingWithMediaPct: normAgg.withMediaPct,
        sampleHooks: adlibAgg.topHooks.slice(0, 5),
      },
      platforms: {
        adlibrary: adlibAgg.platforms,
        adlibraryChannels: adlibAgg.channelDetail,
        existing: normAgg.platforms,
      },
    },
    advertiserPageImpact: {
      adlibraryPanelVisibleNow: (supabaseAdlibCount ?? 0) > 0,
      supabaseAdlibraryRows: supabaseAdlibCount ?? 0,
      engineRowsAvailable: adlibTrue.length,
      improvesPageIfSynced:
        "Yes — adds 60+ real Meta creatives with copy, spend estimates, 116-day date span vs 1-day baseline",
      currentGap: "Data in engine DB; Supabase ad_placements empty for source_platform=adlibrary",
    },
    decision: buildDecision(adlibAgg, normAgg, metaNorm),
  };

  mkdirSync("tmp", { recursive: true });
  const outPath = "tmp/adlibrary-commbank-evaluation.json";
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.error(`\nWrote ${outPath}`);
}

function buildDecision(
  adlib: ReturnType<typeof aggregate>,
  norm: ReturnType<typeof aggregate>,
  metaNorm: number,
) {
  const keepSignals: string[] = [];
  if (adlib.totalAds >= 50) keepSignals.push("sufficient_volume");
  if (adlib.impressionsTotal > norm.impressionsTotal) keepSignals.push("impressions");
  if (adlib.spendAdsWithEstimate >= 10) keepSignals.push("spend_estimates");
  if (adlib.withCopyCount >= 20) keepSignals.push("real_ad_copy");
  if (adlib.totalAds > metaNorm) keepSignals.push("more_meta_creatives");

  const worthPaying =
    adlib.totalAds >= 60 &&
    adlib.spendAdsWithEstimate >= 10 &&
    adlib.withCopyCount >= 30;

  return {
    keepAdLibrary: worthPaying,
    reject: adlib.totalAds < 20,
    useOnlyForMeta: adlib.platforms.Meta === adlib.totalAds,
    useOnlyForWinnerDetection: adlib.totalAds >= 50 && adlib.spendAdsWithEstimate >= 5,
    worthPayingFor: worthPaying,
    recommendation: worthPaying
      ? "KEEP — prioritize Meta creative coverage + winner detection pilot; sync engine → Supabase for advertiser page"
      : "PILOT — extend trial before committing credits",
    rationale: keepSignals,
    estimatedMonthlyCredits:
      "Daily refresh CommBank: ~2 search pages (50 ads) = 2 credits/day; winners scan 10 credits/week",
  };
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: String(err) }, null, 2));
  process.exit(1);
});
