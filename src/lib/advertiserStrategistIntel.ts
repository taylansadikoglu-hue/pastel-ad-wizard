/**
 * Pre-aggregated advertiser strategist tables — GPT summaries by domain.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { safeQuery } from "@/lib/safeQuery";

function rootSlug(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "").split(".")[0] ?? domain;
}

function normaliseDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "");
}

function domainOrFilter(domain: string): string {
  const root = rootSlug(domain);
  const normalized = normaliseDomain(domain);
  return `domain.ilike.%${root}%,domain.ilike.%${normalized}%`;
}

export type AdvertiserStrategistIntel = {
  available: boolean;
  domain: string | null;
  strategistSummary: string | null;
  marketDna: string | null;
  recommendation: string | null;
  positioningArchetype: string | null;
  funnelFocus: string | null;
  dnaSignature: string | null;
  strategySummary: string | null;
  topProduct: string | null;
  topEmotion: string | null;
  topCta: string | null;
  topBuyerStage: string | null;
  topOfferType: string | null;
  placements: number | null;
  narrativeGap: string | null;
  narrativeGapRisk: string | null;
};

export async function fetchAdvertiserStrategistIntel(
  supabase: SupabaseClient<Database>,
  domain: string,
): Promise<AdvertiserStrategistIntel> {
  const empty: AdvertiserStrategistIntel = {
    available: false,
    domain: null,
    strategistSummary: null,
    marketDna: null,
    recommendation: null,
    positioningArchetype: null,
    funnelFocus: null,
    dnaSignature: null,
    strategySummary: null,
    topProduct: null,
    topEmotion: null,
    topCta: null,
    topBuyerStage: null,
    topOfferType: null,
    placements: null,
    narrativeGap: null,
    narrativeGapRisk: null,
  };

  try {
  const filter = domainOrFilter(domain);

  const [snapshotRes, dnaRes, recRes, profileRes, gapRes] = await Promise.all([
    safeQuery("advertiser_strategy_snapshot", () =>
      supabase.from("advertiser_strategy_snapshot").select("*").or(filter).limit(1).maybeSingle(),
    ),
    safeQuery("advertiser_market_dna_summary", () =>
      supabase.from("advertiser_market_dna_summary").select("*").or(filter).limit(1).maybeSingle(),
    ),
    safeQuery("advertiser_recommendations", () =>
      supabase.from("advertiser_recommendations").select("*").or(filter).limit(1).maybeSingle(),
    ),
    safeQuery("advertiser_strategy_profile", () =>
      supabase.from("advertiser_strategy_profile").select("*").or(filter).limit(1).maybeSingle(),
    ),
    safeQuery("ra_narrative_gap", () =>
      supabase
        .from("ra_narrative_gap")
        .select("*")
        .or(`brand.ilike.%${rootSlug(domain)}%,brand.ilike.%${normaliseDomain(domain)}%`)
        .limit(1)
        .maybeSingle(),
    ),
  ]);

  const snapshot = snapshotRes.data && !Array.isArray(snapshotRes.data) ? snapshotRes.data : null;
  const dna = dnaRes.data && !Array.isArray(dnaRes.data) ? dnaRes.data : null;
  const rec = recRes.data && !Array.isArray(recRes.data) ? recRes.data : null;
  const profile = profileRes.data && !Array.isArray(profileRes.data) ? profileRes.data : null;
  const narrativeGap = gapRes.data && !Array.isArray(gapRes.data) ? gapRes.data : null;

  const hasAny = Boolean(snapshot || dna || rec || profile || narrativeGap);
  if (!hasAny) return empty;

  return {
    available: true,
    domain: snapshot?.domain ?? dna?.domain ?? rec?.domain ?? profile?.domain ?? narrativeGap?.brand ?? null,
    strategistSummary: snapshot?.strategist_summary?.trim() || null,
    marketDna: dna?.market_dna?.trim() || null,
    recommendation: rec?.recommendation?.trim() || null,
    positioningArchetype: profile?.positioning_archetype?.trim() || null,
    funnelFocus: profile?.funnel_focus?.trim() || null,
    dnaSignature: profile?.dna_signature?.trim() || null,
    strategySummary: profile?.strategy_summary?.trim() || null,
    topProduct: snapshot?.top_product ?? dna?.top_product ?? profile?.primary_product ?? null,
    topEmotion: snapshot?.top_emotion ?? dna?.top_emotion ?? profile?.primary_emotion ?? null,
    topCta: snapshot?.top_cta ?? dna?.top_cta ?? profile?.primary_cta ?? null,
    topBuyerStage: snapshot?.top_buyer_stage ?? dna?.top_buyer_stage ?? profile?.buyer_stage ?? null,
    topOfferType: snapshot?.top_offer_type ?? dna?.top_offer_type ?? profile?.offer_strategy ?? null,
    placements: snapshot?.placements ?? dna?.placements ?? profile?.placements ?? null,
    narrativeGap: narrativeGap?.narrative_gap_summary?.trim() || null,
    narrativeGapRisk: narrativeGap?.gap_risk?.trim() || null,
  };
  } catch (err) {
    console.warn("[advertiser strategist intel] fetch failed:", err, { domain });
    return empty;
  }
}
