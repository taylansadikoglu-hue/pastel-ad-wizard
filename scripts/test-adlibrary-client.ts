#!/usr/bin/env npx tsx
/**
 * Basic AdLibrary client smoke test.
 *
 * npm run adlibrary:test -- --keyword "CommBank" --limit 5
 * npm run adlibrary:test -- --advertiser-search "CommBank"
 */
import { AdLibraryClient } from "./lib/adlibraryClient.ts";
import { CreditTracker } from "./lib/adlibraryCredits.ts";
import { argBool, argNumber, argString, parseArgs } from "./lib/parseArgs.ts";

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = argBool(args, "dryRun") || !process.env.ADLIBRARY_API_KEY;
  const tracker = new CreditTracker();
  const client = new AdLibraryClient({ dryRun, creditTracker: tracker });

  if (dryRun && !process.env.ADLIBRARY_API_KEY) {
    console.log("[adlibrary:test] No ADLIBRARY_API_KEY — running in dry-run mode");
  }

  const advertiserSearch = argString(args, "advertiserSearch");
  const keyword = argString(args, "keyword") ?? "CommBank";
  const limit = argNumber(args, "limit", 5);

  if (advertiserSearch) {
    const results = await client.searchAdvertisers(advertiserSearch);
    console.log(
      JSON.stringify(
        {
          mode: advertiserSearch,
          status: "ok",
          resultCount: results.length,
          firstResult: results[0] ?? null,
          credits: tracker.summary(),
        },
        null,
        2,
      ),
    );
    return;
  }

  const res = await client.searchAds({
    keyword,
    appType: "3",
    pageSize: Math.min(limit, 50),
    geo: "AUS",
    daysBack: 30,
  });

  console.log(
    JSON.stringify(
      {
        mode: "search",
        status: "ok",
        keyword,
        resultCount: res.ads.length,
        total: res.total ?? res.ads.length,
        firstResult: res.ads[0] ?? null,
        credits: tracker.summary(),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: String(err) }, null, 2));
  process.exit(1);
});
