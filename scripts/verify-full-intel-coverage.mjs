import { createClient } from "@supabase/supabase-js";
import { fetchAdvertiserPlacements } from "../src/lib/advertiserPlacements.ts";
import { fetchAdvertiserStrategistIntel } from "../src/lib/advertiserStrategistIntel.ts";
import { fetchMarketStrategistIntel } from "../src/lib/marketStrategistIntel.ts";
import { buildCampaignStory } from "../src/lib/campaignStory.ts";
import { mergeAdvertiserIntel } from "../src/lib/advertiserPlacements.ts";

const sb = createClient(
  "https://exnngwyhogwltpbjcmyl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4bm5nd3lob2d3bHRwYmpjbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDczNTEsImV4cCI6MjA5NjE4MzM1MX0.ZrKauxuBTlNSlsPoviZnC9i6vcOMcUHWr-jO1cF2Dqw",
);

const domain = "commbank.com.au";
const brand = "CommBank";

const warResp = await fetch("https://api.revenuad.com/api/advertisers/CommBank/warroom").then((r) => r.json());
const [placements, advertiserIntel, marketIntel] = await Promise.all([
  fetchAdvertiserPlacements(sb, domain),
  fetchAdvertiserStrategistIntel(sb, domain),
  fetchMarketStrategistIntel(sb),
]);

const war = mergeAdvertiserIntel(warResp, placements.rows, brand, domain);
const story = buildCampaignStory(brand, war, advertiserIntel);

console.log(JSON.stringify({
  advertiser: {
    strategist: advertiserIntel,
    campaignStoryClientAction: story.quickAnswers.clientShouldDo,
    tableSample: story.table[0],
  },
  market: {
    available: marketIntel.available,
    territories: marketIntel.territories.length,
    risks: marketIntel.risks.length,
    meetingPrep: marketIntel.meetingPrep.length,
    executiveHeadline: marketIntel.executivePack?.headline,
    competitiveGap: marketIntel.competitiveGap?.gapNarrative?.slice(0, 80),
    strategicActions: marketIntel.strategicActions,
  },
}, null, 2));
