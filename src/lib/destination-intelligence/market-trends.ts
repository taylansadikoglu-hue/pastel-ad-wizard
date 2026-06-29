/**
 * Market Intel trend rollups from destination catalogs (multi-advertiser).
 */

import type { AdvertiserDestinationRow, MarketDestinationTrends } from "./types";

type TrendAgg = { label: string; advertisers: Set<string>; ad_count: number };

function aggregateTrend(
  rows: AdvertiserDestinationRow[],
  pick: (r: AdvertiserDestinationRow) => string | null,
  limit = 8,
): TrendAgg[] {
  const map = new Map<string, TrendAgg>();
  for (const row of rows) {
    const label = pick(row)?.trim();
    if (!label) continue;
    const existing = map.get(label) ?? { label, advertisers: new Set<string>(), ad_count: 0 };
    existing.advertisers.add(row.advertiser);
    existing.ad_count += row.ad_count;
    map.set(label, existing);
  }
  return [...map.values()]
    .sort((a, b) => b.ad_count - a.ad_count || b.advertisers.size - a.advertisers.size)
    .slice(0, limit);
}

export function buildMarketDestinationTrends(
  destinations: AdvertiserDestinationRow[],
): MarketDestinationTrends {
  if (!destinations.length) {
    return {
      productTrends: [],
      offerTrends: [],
      audienceTrends: [],
      available: false,
    };
  }

  const toTrend = (agg: TrendAgg) => ({
    label: agg.label,
    advertisers: agg.advertisers.size,
    ad_count: agg.ad_count,
  });

  return {
    productTrends: aggregateTrend(destinations, (r) => r.product).map(toTrend),
    offerTrends: aggregateTrend(destinations, (r) => r.offer).map(toTrend),
    audienceTrends: aggregateTrend(destinations, (r) => r.persona).map(toTrend),
    available: true,
  };
}
