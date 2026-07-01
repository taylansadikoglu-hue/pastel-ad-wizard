#!/usr/bin/env npx tsx
/** Backfill canonical_fingerprint on ad_placements rows missing it. */
import { backfillCanonicalFingerprints } from "./lib/canonicalPlacementUpsert.ts";
import { getSupabaseAdmin } from "./lib/supabaseAdmin.ts";
import { argNumber, parseArgs } from "./lib/parseArgs.ts";

async function main() {
  const args = parseArgs(process.argv);
  const limit = argNumber(args, "limit", 500);
  const supabase = getSupabaseAdmin();
  const { updated, errors } = await backfillCanonicalFingerprints(supabase, limit);
  console.log(`Backfilled ${updated} rows`);
  if (errors.length) {
    console.warn("Errors:", errors.slice(0, 10));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
