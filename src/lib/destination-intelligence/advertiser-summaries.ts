/**
 * Advertiser-page summaries from destination catalog rows.
 */

import type { AdvertiserDestinationRow, AdvertiserDestinationSummary, DestinationMixItem } from "./types";

function mixFromField(
  rows: AdvertiserDestinationRow[],
  pick: (r: AdvertiserDestinationRow) => string | null,
  limit = 5,
): DestinationMixItem[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    const label = pick(row)?.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + row.ad_count);
    total += row.ad_count;
  }
  if (!total) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
    }));
}

export function buildAdvertiserDestinationSummary(
  destinations: AdvertiserDestinationRow[],
): AdvertiserDestinationSummary {
  const incomplete: string[] = [];
  if (!destinations.length) {
    return {
      productsPromoted: [],
      primaryOffers: [],
      primaryAudiences: [],
      funnelMix: [],
      topDestinations: [],
      available: false,
      incomplete: ["No landing-page URLs indexed for this advertiser yet."],
    };
  }

  const totalAds = destinations.reduce((s, d) => s + d.ad_count, 0);

  const productsPromoted = mixFromField(destinations, (r) => r.product);
  if (!productsPromoted.length) incomplete.push("Product names");

  const primaryOffers = mixFromField(destinations, (r) => r.offer);
  if (!primaryOffers.length) incomplete.push("Offers");

  const primaryAudiences = mixFromField(destinations, (r) => r.persona);
  if (!primaryAudiences.length) incomplete.push("Audiences");

  const funnelMix = mixFromField(destinations, (r) => r.funnel_stage);
  if (!funnelMix.length) incomplete.push("Funnel stage");

  const topDestinations = destinations.slice(0, 6).map((d) => ({
    url: d.url,
    domain: d.domain,
    page_title: d.page_title,
    ad_count: d.ad_count,
    pct: totalAds > 0 ? Math.round((d.ad_count / totalAds) * 100) : 0,
  }));

  return {
    productsPromoted,
    primaryOffers,
    primaryAudiences,
    funnelMix,
    topDestinations,
    available: true,
    incomplete,
  };
}
