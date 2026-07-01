#!/usr/bin/env npx tsx
/**
 * Merge duplicate ad_placements rows (same domain + fingerprint).
 *
 * npm run data-quality:merge-dupes
 * npm run data-quality:merge-dupes -- --domain commbank.com.au
 * npm run data-quality:merge-dupes -- --dry-run
 */
import { mergeDuplicatePlacements } from "./lib/mergeDuplicatePlacements.ts";
import { requireWritableSupabase } from "./lib/supabaseAdmin.ts";
import { argBool, argString, parseArgs } from "./lib/parseArgs.ts";

async function main() {
  const args = parseArgs(process.argv);
  const domain = argString(args, "domain");
  const dryRun = argBool(args, "dryRun");
  const limit = Number(argString(args, "limit") ?? "5000");

  const supabase = requireWritableSupabase();
  const stats = await mergeDuplicatePlacements(supabase, { domain: domain ?? undefined, dryRun, limit });

  console.log(dryRun ? "\n[DRY RUN] Merge duplicate placements\n" : "\nMerge duplicate placements\n");
  console.log(`Groups merged: ${stats.groupsFound}`);
  console.log(`Rows folded in: ${stats.rowsMerged}`);
  console.log(`Rows deleted: ${stats.rowsDeleted}`);
  console.log(`Fingerprints set: ${stats.fingerprintsSet}`);
  if (stats.errors.length) {
    console.log(`Errors (${stats.errors.length}):`);
    for (const e of stats.errors.slice(0, 15)) console.log(`  - ${e}`);
  }

  if (!dryRun && domain) {
    console.log(`\nRe-run audit: npm run data-quality:audit -- --domain ${domain}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
