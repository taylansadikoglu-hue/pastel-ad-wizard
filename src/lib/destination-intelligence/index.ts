/**
 * High-level pipeline: ads → catalog → summaries / trends / signal graph.
 * No HTTP APIs — enrichment layer only.
 */

import { buildAdvertiserDestinationSummary } from "./advertiser-summaries";
import { upsertDestinationCatalog } from "./enrich";
import { extractDestinationsFromAds } from "./extract";
import { buildMarketDestinationTrends } from "./market-trends";
import { buildDestinationSignalGraph } from "./signal-graph";
import type {
  AdWithDestination,
  AdvertiserDestinationRow,
  AdvertiserDestinationSummary,
  DestinationSignalGraph,
  MarketDestinationTrends,
} from "./types";

export type DestinationIntelligenceBundle = {
  catalog: AdvertiserDestinationRow[];
  advertiserSummary: AdvertiserDestinationSummary;
  marketTrends: MarketDestinationTrends;
  signalGraph: DestinationSignalGraph;
  extractedCount: number;
  skippedAds: number;
};

export function buildDestinationIntelligence(input: {
  brand: string;
  ads: AdWithDestination[];
  advertiserDomain?: string;
  existingCatalog?: AdvertiserDestinationRow[];
  marketCatalog?: AdvertiserDestinationRow[];
}): DestinationIntelligenceBundle {
  const extractions = extractDestinationsFromAds(input.ads, {
    advertiserDomain: input.advertiserDomain,
    source: "placement",
  });

  const catalog = upsertDestinationCatalog(input.existingCatalog ?? [], extractions);

  const advertiserRows = catalog.filter(
    (r) =>
      r.advertiser === (input.advertiserDomain ?? input.brand).toLowerCase().replace(/^www\./, "") ||
      r.advertiser === input.brand.toLowerCase().replace(/^www\./, ""),
  );

  const marketRows = input.marketCatalog ?? catalog;

  return {
    catalog,
    advertiserSummary: buildAdvertiserDestinationSummary(advertiserRows.length ? advertiserRows : catalog),
    marketTrends: buildMarketDestinationTrends(marketRows),
    signalGraph: buildDestinationSignalGraph(input.brand, advertiserRows.length ? advertiserRows : catalog),
    extractedCount: extractions.length,
    skippedAds: input.ads.length - extractions.length,
  };
}

export * from "./types";
export * from "./extract";
export * from "./enrich";
export * from "./advertiser-summaries";
export * from "./market-trends";
export * from "./signal-graph";
export { loadDestinationsForAdvertiser, placementToAdWithDestination } from "./load-from-placements";
