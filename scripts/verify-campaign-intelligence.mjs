import { createClient } from "@supabase/supabase-js";
import { fetchAdvertiserPlacements, mergeAdvertiserIntel } from "../src/lib/advertiserPlacements.ts";
import { buildCampaignIntelligence } from "../src/lib/campaignIntelligence.ts";

const sb = createClient(
  "https://exnngwyhogwltpbjcmyl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4bm5nd3lob2d3bHRwYmpjbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDczNTEsImV4cCI6MjA5NjE4MzM1MX0.ZrKauxuBTlNSlsPoviZnC9i6vcOMcUHWr-jO1cF2Dqw",
);

const domain = "commbank.com.au";
const brand = "CommBank";
const QUERY = `supabase.from("normalized_ad_placements").select("${[
  "first_seen","last_seen","times_seen","campaign_cluster","offer_type",
  "emotional_driver","buyer_stage","primary_cta","channel_platform",
  "product_type","offer_signal","market_signal","strategist_takeaway",
].join(",")}").or("domain.ilike.%commbank%,domain.ilike.%commbank.com.au%").limit(100)`;

const warResp = await fetch("https://api.revenuad.com/api/advertisers/CommBank/warroom").then((r) => r.json());
const placementFetch = await fetchAdvertiserPlacements(sb, domain);
const merged = mergeAdvertiserIntel(warResp, placementFetch.rows, brand, domain);
const intel = buildCampaignIntelligence(brand, merged);

console.log(JSON.stringify({
  query: QUERY,
  rowCount: intel.rowCount,
  placementSource: placementFetch.source,
  sections: {
    currentCampaigns: intel.currentCampaigns.length,
    messagingBreakdown: intel.messagingBreakdown,
    ctaBreakdown: intel.ctaBreakdown,
    timeline: {
      newest: intel.timeline.newest.length,
      refreshed: intel.timeline.refreshed.length,
      oldestActive: intel.timeline.oldestActive.length,
    },
    creativeFatigue: intel.creativeFatigue,
    whatsChanged: intel.whatsChanged,
    channelOwnership: intel.channelOwnership.filter((c) => c.count > 0),
  },
  sampleCampaign: intel.currentCampaigns[0],
  blockSoWhat: intel.blockSoWhat,
}, null, 2));
