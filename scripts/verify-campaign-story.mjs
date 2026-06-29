import { createClient } from "@supabase/supabase-js";
import { fetchAdvertiserPlacements, mergeAdvertiserIntel } from "../src/lib/advertiserPlacements.ts";
import { buildCampaignStory } from "../src/lib/campaignStory.ts";

const sb = createClient(
  "https://exnngwyhogwltpbjcmyl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4bm5nd3lob2d3bHRwYmpjbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDczNTEsImV4cCI6MjA5NjE4MzM1MX0.ZrKauxuBTlNSlsPoviZnC9i6vcOMcUHWr-jO1cF2Dqw",
);

const domain = "commbank.com.au";
const brand = "CommBank";

const warResp = await fetch("https://api.revenuad.com/api/advertisers/CommBank/warroom").then((r) => r.json());
const placementFetch = await fetchAdvertiserPlacements(sb, domain);
const merged = mergeAdvertiserIntel(warResp, placementFetch.rows, brand, domain);
const story = buildCampaignStory(brand, merged);

console.log(JSON.stringify({
  rowCount: story.rowCount,
  available: story.available,
  placementSource: placementFetch.source,
  quickAnswers: story.quickAnswers,
  executiveSummary: story.executiveSummary,
  table: story.table,
}, null, 2));
