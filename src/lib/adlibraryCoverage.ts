/**
 * AdLibrary coverage stats for Market Intel health card and advertiser badges.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdlibraryCoverage = {
  advertisersTracked: number;
  adsIndexed: number;
  enrichedAds: number;
  lastRunAt: string | null;
  creditsRemaining: number | null;
  hasData: boolean;
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
};

export async function fetchAdlibraryCoverage(
  supabase: SupabaseClient,
): Promise<AdlibraryCoverage> {
  const [candidatesRes, adsRes, enrichRes, runRes] = await Promise.all([
    safeCount(supabase, "adlibrary_advertiser_candidates"),
    supabase
      .from("ad_placements")
      .select("id", { count: "exact", head: true })
      .eq("source_platform", "adlibrary"),
    safeCount(supabase, "adlibrary_enrichments"),
    supabase
      .from("adlibrary_pipeline_runs")
      .select("finished_at, credits_remaining, status")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const advertisersTracked = candidatesRes.count ?? 0;
  const adsIndexed = adsRes.count ?? 0;
  const enrichedAds = enrichRes.count ?? 0;

  return {
    advertisersTracked,
    adsIndexed,
    enrichedAds,
    lastRunAt: runRes.data?.finished_at ?? null,
    creditsRemaining: runRes.data?.credits_remaining ?? null,
    hasData: adsIndexed > 0 || advertisersTracked > 0,
  };
}

export async function fetchAdlibraryAdvertiserIntel(
  supabase: SupabaseClient,
  domain: string,
  brand: string,
): Promise<AdlibraryAdvertiserIntel> {
  const [adsRes, enrichRes, winnersRes] = await Promise.all([
    supabase
      .from("ad_placements")
      .select("id, source_archive_url, creative_url, media_url")
      .eq("source_platform", "adlibrary")
      .or(`domain.eq.${domain},advertiser_name.ilike.%${brand}%`)
      .limit(20),
    supabase
      .from("adlibrary_enrichments")
      .select("summary")
      .ilike("advertiser_name", `%${brand}%`)
      .order("enriched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("adlibrary_winning_concepts")
      .select("ad_key, tier, composite_score, tags")
      .ilike("advertiser_name", `%${brand}%`)
      .order("composite_score", { ascending: false })
      .limit(5),
  ]);

  const ads = adsRes.data ?? [];
  const sample = ads[0];

  return {
    hasAdlibraryAds: ads.length > 0,
    adlibraryAdCount: ads.length,
    enrichmentSummary: enrichRes.data?.summary ?? null,
    winningConcepts: winnersRes.data ?? [],
    sampleSourceUrl:
      sample?.source_archive_url ??
      sample?.creative_url ??
      sample?.media_url ??
      null,
  };
}

async function safeCount(
  supabase: SupabaseClient,
  table: string,
): Promise<{ count: number | null; error: unknown }> {
  const res = await supabase.from(table).select("id", { count: "exact", head: true });
  if (res.error) return { count: 0, error: res.error };
  return { count: res.count };
}
