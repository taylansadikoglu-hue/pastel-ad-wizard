/**
 * AdLibrary coverage stats for Market Intel health card and advertiser badges.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeCount, safeQuery } from "@/lib/safeQuery";

export type AdlibraryCoverage = {
  advertisersTracked: number;
  adsIndexed: number;
  enrichedAds: number;
  lastRunAt: string | null;
  creditsRemaining: number | null;
  hasData: boolean;
  /** False when optional AdLibrary tables are missing or unreachable. */
  available: boolean;
};

export type AdlibraryAdvertiserIntel = {
  hasAdlibraryAds: boolean;
  adlibraryAdCount: number;
  enrichmentSummary: string | null;
  winningConcepts: {
    ad_key: string | null;
    tier: string | null;
    composite_score: number | null;
    tags: unknown;
  }[];
  sampleSourceUrl: string | null;
  available: boolean;
};

const EMPTY_COVERAGE: AdlibraryCoverage = {
  advertisersTracked: 0,
  adsIndexed: 0,
  enrichedAds: 0,
  lastRunAt: null,
  creditsRemaining: null,
  hasData: false,
  available: false,
};

const EMPTY_ADVERTISER_INTEL: AdlibraryAdvertiserIntel = {
  hasAdlibraryAds: false,
  adlibraryAdCount: 0,
  enrichmentSummary: null,
  winningConcepts: [],
  sampleSourceUrl: null,
  available: false,
};

export async function fetchAdlibraryCoverage(
  supabase: SupabaseClient,
): Promise<AdlibraryCoverage> {
  const [candidatesRes, adsRes, enrichRes, runRes] = await Promise.all([
    safeCount(supabase, "adlibrary_advertiser_candidates"),
    safeQuery("ad_placements_adlibrary", async () => {
      const r = await supabase
        .from("ad_placements")
        .select("id", { count: "exact", head: true })
        .eq("source_platform", "adlibrary");
      return { data: r.count ?? 0, error: r.error };
    }),
    safeCount(supabase, "adlibrary_enrichments"),
    safeQuery("adlibrary_pipeline_runs", () =>
      supabase
        .from("adlibrary_pipeline_runs")
        .select("finished_at, credits_remaining, status")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  ]);

  const optionalAvailable =
    candidatesRes.available && enrichRes.available && runRes.available;

  const adsIndexed = adsRes.available ? (adsRes.data ?? 0) : 0;

  return {
    advertisersTracked: candidatesRes.available ? candidatesRes.count : 0,
    adsIndexed,
    enrichedAds: enrichRes.available ? enrichRes.count : 0,
    lastRunAt: runRes.available ? (runRes.data?.finished_at ?? null) : null,
    creditsRemaining: runRes.available ? (runRes.data?.credits_remaining ?? null) : null,
    hasData:
      optionalAvailable &&
      (adsIndexed > 0 || candidatesRes.count > 0 || enrichRes.count > 0),
    available: optionalAvailable,
  };
}

export async function fetchAdlibraryAdvertiserIntel(
  supabase: SupabaseClient,
  domain: string,
  brand: string,
): Promise<AdlibraryAdvertiserIntel> {
  const [adsRes, enrichRes, winnersRes] = await Promise.all([
    safeQuery("ad_placements_adlibrary", () =>
      supabase
        .from("ad_placements")
        .select("id, source_archive_url, creative_url, media_url")
        .eq("source_platform", "adlibrary")
        .or(`domain.eq.${domain},advertiser_name.ilike.%${brand}%`)
        .limit(20),
    ),
    safeQuery("adlibrary_enrichments", () =>
      supabase
        .from("adlibrary_enrichments")
        .select("summary")
        .ilike("advertiser_name", `%${brand}%`)
        .order("enriched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
    safeQuery("adlibrary_winning_concepts", () =>
      supabase
        .from("adlibrary_winning_concepts")
        .select("ad_key, tier, composite_score, tags")
        .ilike("advertiser_name", `%${brand}%`)
        .order("composite_score", { ascending: false })
        .limit(5),
    ),
  ]);

  const optionalAvailable =
    enrichRes.available && winnersRes.available;

  if (!adsRes.available && !enrichRes.available && !winnersRes.available) {
    return EMPTY_ADVERTISER_INTEL;
  }

  const ads = Array.isArray(adsRes.data) ? adsRes.data : [];
  const sample = ads[0] as
    | { source_archive_url?: string; creative_url?: string; media_url?: string }
    | undefined;

  return {
    hasAdlibraryAds: ads.length > 0,
    adlibraryAdCount: ads.length,
    enrichmentSummary:
      enrichRes.available && enrichRes.data && !Array.isArray(enrichRes.data)
        ? ((enrichRes.data as { summary?: string }).summary ?? null)
        : null,
    winningConcepts: winnersRes.available && Array.isArray(winnersRes.data) ? winnersRes.data : [],
    sampleSourceUrl:
      sample?.source_archive_url ?? sample?.creative_url ?? sample?.media_url ?? null,
    available: optionalAvailable || adsRes.available,
  };
}

export { EMPTY_COVERAGE, EMPTY_ADVERTISER_INTEL };
