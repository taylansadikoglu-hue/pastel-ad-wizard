/**
 * Verification script — CommBank advertiser brief payloads.
 * Run: npx tsx scripts/verify-commbank-brief.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { fetchAdvertiserPlacements, mergeAdvertiserIntel } from "../src/lib/advertiserPlacements.ts";
import {
  buildProductsPromoted,
  buildWhatTheyreSaying,
  buildAudiencesPersonas,
  buildMeetingTalkingPoints,
  buildCurrentMarketingRead,
  buildAdvertiserChannelMix,
  buildWhatTheyreMissing,
  buildAdvertiserRecommendedMoves,
} from "../src/lib/radAdvertiserBrief.ts";

const sb = createClient(
  "https://exnngwyhogwltpbjcmyl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4bm5nd3lob2d3bHRwYmpjbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDczNTEsImV4cCI6MjA5NjE4MzM1MX0.ZrKauxuBTlNSlsPoviZnC9i6vcOMcUHWr-jO1cF2Dqw",
);

const domain = "commbank.com.au";
const brand = "CommBank";

const warResp = await fetch("https://api.revenuad.com/api/advertisers/CommBank/warroom").then((r) => r.json());
const placementFetch = await fetchAdvertiserPlacements(sb, domain);
const placements = placementFetch.rows;
const merged = mergeAdvertiserIntel(warResp, placements, brand, domain);

const payload = {
  meta: {
    domain,
    brand,
    placementRowsFetched: placements.length,
    placementSource: placementFetch.source,
    placementFetchError: placementFetch.error,
    warroomTotalAds: warResp.total_ads,
    warroomRecentAds: warResp.recent_ads?.length ?? 0,
    mergedPlacements: merged?.placements?.length ?? 0,
    verifiedAt: new Date().toISOString(),
  },
  sections: {
    currentMarketingRead: buildCurrentMarketingRead(brand, merged),
    channelMix: buildAdvertiserChannelMix(merged).rows.filter((r) => r.pct > 0),
    productsPromoted: buildProductsPromoted(merged),
    whatTheyreSaying: buildWhatTheyreSaying(merged),
    audiencesPersonas: buildAudiencesPersonas(merged),
    whatTheyreMissing: buildWhatTheyreMissing(brand, merged),
    recommendedMoves: buildAdvertiserRecommendedMoves(brand, merged),
    meetingTalkingPoints: buildMeetingTalkingPoints(brand, merged),
  },
  samplePlacement: placements[0],
};

console.log(JSON.stringify(payload, null, 2));
