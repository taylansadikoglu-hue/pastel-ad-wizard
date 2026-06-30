/**
 * Advertiser placement intel — flattened columns from ad_placements /
 * normalized_ad_placements. No ai_tags.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { bucketChannel, normaliseChannelBadge } from "@/lib/channels";

export { normaliseChannelBadge } from "@/lib/channels";

export const PLACEMENT_INTEL_SELECT = [
  "id",
  "advertiser_name",
  "domain",
  "ad_title",
  "channel",
  "channel_platform",
  "ad_type",
  "raw_copy",
  "buyer_stage",
  "offer_type",
  "emotional_driver",
  "hook_analysis",
  "strategist_takeaway",
  "product_category",
  "offer_theme",
  "page_title",
  "page_description",
  "extracted_offer",
  "detected_cta",
  "primary_cta",
  "product_type",
  "offer_signal",
  "market_signal",
  "offer_theme",
  "description",
  "page_description",
  "normalized_product",
  "headline",
  "description",
  "first_seen",
  "last_seen",
  "times_seen",
  "days_running",
  "campaign_cluster",
  "media_url",
  "creative_url",
  "landing_url",
  "source_archive_url",
  "raw",
].join(", ");

export type AdvertiserPlacementRow = {
  id: number | string;
  advertiser_name?: string | null;
  ad_title?: string | null;
  domain?: string | null;
  channel?: string | null;
  channel_platform?: string | null;
  ad_type?: string | null;
  raw_copy?: string | null;
  buyer_stage?: string | null;
  offer_type?: string | null;
  emotional_driver?: string | null;
  hook_analysis?: string | null;
  strategist_takeaway?: string | null;
  product_category?: string | null;
  offer_theme?: string | null;
  page_title?: string | null;
  page_description?: string | null;
  extracted_offer?: string | null;
  detected_cta?: string | null;
  primary_cta?: string | null;
  product_type?: string | null;
  offer_signal?: string | null;
  market_signal?: string | null;
  offer_theme?: string | null;
  description?: string | null;
  page_description?: string | null;
  normalized_product?: string | null;
  raw?: Record<string, unknown> | null;
  headline?: string | null;
  description?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  times_seen?: number | null;
  days_running?: number | null;
  campaign_cluster?: string | null;
  media_url?: string | null;
  creative_url?: string | null;
  landing_url?: string | null;
  source_archive_url?: string | null;
};

export type PlacementChannelEntry = {
  channel: string;
  ad_count: number;
  pct: number;
};

function rootSlug(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "").split(".")[0] ?? domain;
}

function normaliseDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "");
}

function isUsableText(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;
  const v = value.trim();
  if (v.includes("{{")) return false;
  if (/^creative detected for/i.test(v)) return false;
  if (/copy unavailable from source feed/i.test(v)) return false;
  return true;
}

export function normalisePlacementRow(row: Record<string, unknown>): AdvertiserPlacementRow {
  return {
    id: (row.id as number | string) ?? crypto.randomUUID(),
    advertiser_name: (row.advertiser_name as string | null) ?? null,
    ad_title: (row.ad_title as string | null) ?? null,
    domain: (row.domain as string | null) ?? null,
    channel: (row.channel as string | null) ?? null,
    channel_platform: (row.channel_platform as string | null) ?? null,
    ad_type: (row.ad_type as string | null) ?? null,
    raw_copy: (row.raw_copy as string | null) ?? null,
    buyer_stage: (row.buyer_stage as string | null) ?? null,
    offer_type: (row.offer_type as string | null) ?? null,
    emotional_driver: (row.emotional_driver as string | null) ?? null,
    hook_analysis: (row.hook_analysis as string | null) ?? null,
    strategist_takeaway: (row.strategist_takeaway as string | null) ?? null,
    product_category: (row.product_category as string | null) ?? null,
    offer_theme: (row.offer_theme as string | null) ?? null,
    page_title: (row.page_title as string | null) ?? null,
    page_description: (row.page_description as string | null) ?? null,
    extracted_offer: (row.extracted_offer as string | null) ?? null,
    detected_cta: (row.detected_cta as string | null) ?? null,
    primary_cta: (row.primary_cta as string | null) ?? null,
    product_type: (row.product_type as string | null) ?? null,
    offer_signal: (row.offer_signal as string | null) ?? null,
    market_signal: (row.market_signal as string | null) ?? null,
    offer_theme: (row.offer_theme as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    page_description: (row.page_description as string | null) ?? null,
    normalized_product: (row.normalized_product as string | null) ?? null,
    raw: (row.raw as Record<string, unknown> | null) ?? null,
    headline: (row.headline as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    first_seen: (row.first_seen as string | null) ?? null,
    last_seen: (row.last_seen as string | null) ?? null,
    times_seen: row.times_seen != null ? Number(row.times_seen) : null,
    days_running: row.days_running != null ? Number(row.days_running) : null,
    campaign_cluster: (row.campaign_cluster as string | null) ?? null,
    media_url: (row.media_url as string | null) ?? null,
    creative_url: (row.creative_url as string | null) ?? null,
    landing_url: (row.landing_url as string | null) ?? null,
    source_archive_url: (row.source_archive_url as string | null) ?? null,
  };
}

/** Channel mix from observed channel_platform counts. */
export function buildChannelsFromPlacements(
  placements: AdvertiserPlacementRow[],
): PlacementChannelEntry[] {
  const counts = new Map<string, number>();
  for (const row of placements) {
    const badge = normaliseChannelBadge(row.channel_platform ?? row.channel);
    if (!badge) continue;
    const bucket = bucketChannel(badge);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];
  return [...counts.entries()]
    .map(([channel, ad_count]) => ({
      channel,
      ad_count,
      pct: Math.round((ad_count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.ad_count - a.ad_count);
}

export const PLACEMENT_INTEL_UNAVAILABLE =
  "Placement intelligence unavailable from browser client";

export type PlacementFetchSource = "normalized_ad_placements" | "ad_placements" | "none";

export type PlacementFetchResult = {
  rows: AdvertiserPlacementRow[];
  source: PlacementFetchSource;
  error: string | null;
};

export async function fetchAdvertiserPlacements(
  supabase: SupabaseClient<Database>,
  domain: string,
  limit = 100,
): Promise<PlacementFetchResult> {
  const root = rootSlug(domain);
  const normalized = normaliseDomain(domain);
  const pattern = `%${root}%`;
  const domainFilter = `domain.ilike.${pattern},domain.ilike.%${normalized}%`;

  const { data: normalizedRows, error: normalizedError } = await supabase
    .from("normalized_ad_placements")
    .select(PLACEMENT_INTEL_SELECT)
    .or(domainFilter)
    .order("last_seen", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (normalizedError) {
    console.warn(
      "[advertiser placements] normalized_ad_placements fetch failed:",
      normalizedError.message,
      { domain },
    );
  } else if (!normalizedRows?.length) {
    console.warn(
      "[advertiser placements] normalized_ad_placements returned 0 rows:",
      { domain },
    );
  }

  if (normalizedRows?.length) {
    return {
      rows: normalizedRows.map((row) => normalisePlacementRow(row as Record<string, unknown>)),
      source: "normalized_ad_placements",
      error: normalizedError?.message ?? null,
    };
  }

  const { data: placementRows, error: placementError } = await supabase
    .from("ad_placements")
    .select(PLACEMENT_INTEL_SELECT.replace("normalized_product,", ""))
    .or(domainFilter)
    .order("last_seen", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (placementError) {
    console.warn(
      "[advertiser placements] ad_placements fallback fetch failed:",
      placementError.message,
      { domain },
    );
  }

  const rows = (placementRows ?? []).map((row) => normalisePlacementRow(row as Record<string, unknown>));
  return {
    rows,
    source: rows.length ? "ad_placements" : "none",
    error: normalizedError?.message ?? placementError?.message ?? null,
  };
}

export type AdvertiserIntelWar = {
  advertiser?: string;
  name?: string;
  domain?: string;
  industry?: string;
  category?: string;
  total_ads?: number;
  first_seen?: string;
  last_seen?: string;
  ads_this_week?: number;
  spend_signal?: number;
  channels?: PlacementChannelEntry[];
  spend?: { est_monthly_aud?: number; spend_confidence?: string } | null;
  spend_weight?: {
    byChannel?: Record<string, { percentage?: number; adCount?: number; spend?: number } | number>;
  };
  creative_fatigue?: {
    score?: number;
    portfolioFatigueScore?: number;
    fatigueLabel?: string;
    needsRefresh?: number;
    fatigued?: number;
    fresh?: number;
  };
  placements: AdvertiserPlacementRow[];
  top_cta?: string | null;
  top_themes?: ({ theme: string; count?: number; pct?: number } | string)[];
  themes?: { theme: string; count?: number }[];
  recent_ads?: AdvertiserPlacementRow[];
};

type WarroomLike = Partial<AdvertiserIntelWar> & {
  channels?: unknown;
  recent_ads?: unknown;
};

/** Merge warroom payload with Supabase placement rows (placements win for intel fields). */
export function mergeAdvertiserIntel(
  war: WarroomLike | null,
  placements: AdvertiserPlacementRow[],
  brand: string,
  domain: string,
): AdvertiserIntelWar | null {
  if (!war && !placements.length) return null;

  const placementChannels = buildChannelsFromPlacements(placements);
  const warChannels = Array.isArray(war?.channels) && war.channels.length
    ? (war.channels as PlacementChannelEntry[])
    : [];

  const channels = warChannels.length ? warChannels : placementChannels;
  const sortedBySeen = [...placements].sort((a, b) => {
    const ta = new Date(a.last_seen ?? a.first_seen ?? 0).getTime();
    const tb = new Date(b.last_seen ?? b.first_seen ?? 0).getTime();
    return tb - ta;
  });

  const firstSeen = sortedBySeen[sortedBySeen.length - 1]?.first_seen ?? war?.first_seen;
  const lastSeen = sortedBySeen[0]?.last_seen ?? war?.last_seen;

  return {
    advertiser: war?.advertiser ?? war?.name ?? brand,
    name: war?.name,
    domain: war?.domain ?? domain,
    industry: war?.industry,
    category: war?.category,
    total_ads: Math.max(Number(war?.total_ads ?? 0), placements.length),
    first_seen: firstSeen ?? undefined,
    last_seen: lastSeen ?? undefined,
    ads_this_week: war?.ads_this_week,
    spend_signal: war?.spend_signal,
    channels,
    spend: war?.spend ?? null,
    spend_weight: war?.spend_weight,
    creative_fatigue: war?.creative_fatigue,
    placements: sortedBySeen,
    recent_ads: sortedBySeen,
    top_cta: war?.top_cta ?? null,
    top_themes: war?.top_themes,
    themes: war?.themes,
  };
}

export function placementCount(war: AdvertiserIntelWar | null | undefined): number {
  return war?.placements?.length ?? war?.recent_ads?.length ?? 0;
}

export function hasPlacementIntel(war: AdvertiserIntelWar | null | undefined): boolean {
  return placementCount(war) > 0;
}

export { isUsableText };
