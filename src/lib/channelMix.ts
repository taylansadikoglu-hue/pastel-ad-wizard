/**
 * Channel mix waterfall — never hide; always show High / Medium / Low confidence.
 *
 * Priority:
 * 1. Placement channels (channel_platform on indexed placement rows)
 * 2. AdLibrary channels
 * 3. Warroom channels (engine API)
 * 4. Estimated from indexed placements (infer / even split)
 */

import type { AdvertiserPlacementRow, PlacementChannelEntry } from "@/lib/advertiserPlacements";
import {
  buildChannelsFromPlacements,
  normaliseChannelBadge,
  placementCount,
} from "@/lib/advertiserPlacements";
import { DISPLAY_CHANNELS, bucketChannel } from "@/lib/channels";

export type ChannelConfidence = "High" | "Medium" | "Low";

export type ChannelMixSource =
  | "placements"
  | "adlibrary"
  | "warroom"
  | "estimated"
  | "baseline";

export type ChannelMixRow = {
  channel: string;
  pct: number;
  ads: number;
  confidence: ChannelConfidence;
};

export type ChannelMixResult = {
  rows: ChannelMixRow[];
  overallConfidence: ChannelConfidence;
  available: true;
  source: ChannelMixSource;
  sourceLabel: string;
  estimationTooltip: string;
};

const SOURCE_LABELS: Record<ChannelMixSource, string> = {
  placements: "Indexed placement channels",
  adlibrary: "AdLibrary indexed creatives",
  warroom: "Engine warroom channels",
  estimated: "Estimated from indexed placements",
  baseline: "Category baseline estimate",
};

const SOURCE_TOOLTIPS: Record<ChannelMixSource, string> = {
  placements:
    "Share is calculated from channel_platform on placement rows stored in Supabase.",
  adlibrary:
    "Share is calculated from AdLibrary-sourced placement rows (Meta, TikTok, LinkedIn, and more).",
  warroom:
    "Share comes from the engine warroom API channel split for this advertiser.",
  estimated:
    "Placements exist but lack channel tags — share is inferred from ad type and row signals.",
  baseline:
    "No channel attribution yet — showing an even baseline until placements are indexed.",
};

function channelsToMap(entries: PlacementChannelEntry[]): Map<string, { pct: number; ads: number }> {
  const map = new Map<string, { pct: number; ads: number }>();
  for (const entry of entries) {
    const badge = normaliseChannelBadge(entry.channel) ?? "Other";
    const bucket = bucketChannel(badge);
    const ads = Number(entry.ad_count ?? 0);
    const pct = Number(entry.pct ?? 0);
    const existing = map.get(bucket);
    if (existing) {
      existing.ads += ads;
      existing.pct += pct;
    } else {
      map.set(bucket, { pct, ads });
    }
  }
  return map;
}

function mapFromPlacements(rows: AdvertiserPlacementRow[]): Map<string, { pct: number; ads: number }> | null {
  const entries = buildChannelsFromPlacements(rows);
  if (!entries.length) return null;
  return channelsToMap(entries);
}

function mapFromWarroom(channels: PlacementChannelEntry[] | undefined): Map<string, { pct: number; ads: number }> | null {
  if (!channels?.length) return null;
  const map = channelsToMap(channels);
  const hasSignal = [...map.values()].some((v) => v.pct > 0 || v.ads > 0);
  return hasSignal ? map : null;
}

function estimateFromPlacements(rows: AdvertiserPlacementRow[]): Map<string, { pct: number; ads: number }> | null {
  if (!rows.length) return null;

  const counts = new Map<string, number>();
  for (const row of rows) {
    const fromPlatform = normaliseChannelBadge(row.channel_platform ?? row.channel);
    const fromType = normaliseChannelBadge(row.ad_type);
    const badge = fromPlatform ?? fromType ?? null;
    if (badge) counts.set(badge, (counts.get(badge) ?? 0) + 1);
  }

  if (counts.size > 0) {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const map = new Map<string, { pct: number; ads: number }>();
    for (const [channel, ads] of counts) {
      const bucket = bucketChannel(channel);
      const pct = Math.round((ads / total) * 1000) / 10;
      const existing = map.get(bucket);
      if (existing) {
        existing.ads += ads;
        existing.pct += pct;
      } else {
        map.set(bucket, { pct, ads });
      }
    }
    return map;
  }

  // Even split across primary channels when rows exist but lack attribution
  const perChannel = Math.round((100 / DISPLAY_CHANNELS.length) * 10) / 10;
  const adsEach = Math.max(1, Math.floor(rows.length / DISPLAY_CHANNELS.length));
  const map = new Map<string, { pct: number; ads: number }>();
  for (const channel of DISPLAY_CHANNELS) {
    map.set(channel, { pct: perChannel, ads: adsEach });
  }
  return map;
}

function baselineMap(): Map<string, { pct: number; ads: number }> {
  const perChannel = Math.round((100 / DISPLAY_CHANNELS.length) * 10) / 10;
  const map = new Map<string, { pct: number; ads: number }>();
  for (const channel of DISPLAY_CHANNELS) {
    map.set(channel, { pct: perChannel, ads: 0 });
  }
  return map;
}

function confidenceForSource(
  source: ChannelMixSource,
  totalAds: number,
  activeChannels: number,
): ChannelConfidence {
  if (source === "placements") {
    if (totalAds >= 5 && activeChannels >= 3) return "High";
    if (totalAds >= 1) return "Medium";
    return "Low";
  }
  if (source === "adlibrary" || source === "warroom") return totalAds >= 3 ? "Medium" : "Low";
  return "Low";
}

function buildRows(
  map: Map<string, { pct: number; ads: number }>,
  rowConfidence: ChannelConfidence,
): ChannelMixRow[] {
  return DISPLAY_CHANNELS.map((channel) => {
    const data = map.get(channel);
    const pct = data?.pct ?? 0;
    const ads = data?.ads ?? 0;
    const hasSignal = pct > 0 || ads > 0;
    return {
      channel,
      pct,
      ads,
      confidence: hasSignal ? rowConfidence : "Low",
    };
  });
}

export type BuildChannelMixInput = {
  placementRows?: AdvertiserPlacementRow[];
  adlibraryRows?: AdvertiserPlacementRow[];
  warroomChannels?: PlacementChannelEntry[];
};

export function buildChannelMix(input: BuildChannelMixInput): ChannelMixResult {
  const placementRows = input.placementRows ?? [];
  const adlibraryRows = input.adlibraryRows ?? [];

  let source: ChannelMixSource = "baseline";
  let map: Map<string, { pct: number; ads: number }> | null = null;

  map = mapFromPlacements(placementRows);
  if (map) source = "placements";

  if (!map) {
    map = mapFromPlacements(adlibraryRows);
    if (map) source = "adlibrary";
  }

  if (!map) {
    map = mapFromWarroom(input.warroomChannels);
    if (map) source = "warroom";
  }

  if (!map) {
    map = estimateFromPlacements(placementRows.length ? placementRows : adlibraryRows);
    if (map) source = "estimated";
  }

  if (!map) {
    map = baselineMap();
    source = "baseline";
  }

  const totalAds =
    source === "adlibrary"
      ? adlibraryRows.length
      : source === "warroom"
        ? input.warroomChannels?.reduce((sum, c) => sum + Number(c.ad_count ?? 0), 0) ?? 0
        : placementCount({ placements: placementRows, recent_ads: placementRows });

  const activeChannels = [...map.values()].filter((v) => v.pct > 0 || v.ads > 0).length;
  const overallConfidence = confidenceForSource(source, totalAds, activeChannels);

  let estimationTooltip = SOURCE_TOOLTIPS[source];
  if (overallConfidence === "Low" && source !== "baseline") {
    estimationTooltip += " Limited placement volume — treat as directional.";
  }

  return {
    rows: buildRows(map, overallConfidence),
    overallConfidence,
    available: true,
    source,
    sourceLabel: SOURCE_LABELS[source],
    estimationTooltip,
  };
}

/** Market-level channel mix from bundle JSON with fallback baseline. */
export function buildMarketChannelMix(
  raw: Record<string, unknown> | null | undefined,
): ChannelMixResult {
  if (!raw) return buildChannelMix({});

  const byChannel = raw.byChannel ?? raw.by_channel ?? raw.channels;
  if (!byChannel || typeof byChannel !== "object") return buildChannelMix({});

  const warroomChannels: PlacementChannelEntry[] = [];

  if (Array.isArray(byChannel)) {
    for (const row of byChannel as { channel?: string; pct?: number; ad_count?: number }[]) {
      warroomChannels.push({
        channel: String(row.channel ?? ""),
        ad_count: Number(row.ad_count ?? 0),
        pct: Number(row.pct ?? 0),
      });
    }
  } else {
    for (const [key, val] of Object.entries(byChannel as Record<string, { pct?: number; percentage?: number; adCount?: number } | number>)) {
      const pct = typeof val === "number" ? val : Number(val?.pct ?? val?.percentage ?? 0);
      const ad_count = typeof val === "number" ? 0 : Number(val?.adCount ?? 0);
      if (pct > 0 || ad_count > 0) {
        warroomChannels.push({ channel: key, pct, ad_count });
      }
    }
  }

  return buildChannelMix({ warroomChannels });
}

export { DISPLAY_CHANNELS };
