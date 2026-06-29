import { createClient } from "@supabase/supabase-js";
import { fetchAdvertiserPlacements } from "../src/lib/advertiserPlacements.ts";
import { fetchAdvertiserStrategistIntel } from "../src/lib/advertiserStrategistIntel.ts";

const sb = createClient(
  "https://exnngwyhogwltpbjcmyl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4bm5nd3lob2d3bHRwYmpjbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDczNTEsImV4cCI6MjA5NjE4MzM1MX0.ZrKauxuBTlNSlsPoviZnC9i6vcOMcUHWr-jO1cF2Dqw",
);

const domain = "commbank.com.au";
const [placements, strategist] = await Promise.all([
  fetchAdvertiserPlacements(sb, domain),
  fetchAdvertiserStrategistIntel(sb, domain),
]);

const withArchive = placements.rows.filter((r) => r.source_archive_url).length;
const withTitle = placements.rows.filter((r) => r.ad_title).length;
const copySnippets = placements.rows.map((r) => r.raw_copy).filter(Boolean).slice(0, 3);

console.log(JSON.stringify({
  domain,
  placementRows: placements.rows.length,
  withArchive,
  withTitle,
  copySnippetSample: copySnippets[0]?.slice(0, 120),
  strategist,
}, null, 2));
