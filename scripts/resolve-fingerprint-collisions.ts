#!/usr/bin/env npx tsx
/**
 * Resolve fingerprint collisions: merge orphans into keepers, then backfill.
 *
 * npm run data-quality:resolve-collisions
 * npm run data-quality:resolve-collisions -- --domain commbank.com.au
 */
import { backfillCanonicalFingerprints } from "./lib/canonicalPlacementUpsert.ts";
import { mergeDuplicatePlacements } from "./lib/mergeDuplicatePlacements.ts";
import { requireWritableSupabase } from "./lib/supabaseAdmin.ts";
import { argBool, argString, parseArgs } from "./lib/parseArgs.ts";

async function main() {
  const args = parseArgs(process.argv);
  const domain = argString(args, "domain");
  const dryRun = argBool(args, "dryRun");
  const limit = Number(argString(args, "limit") ?? "5000");

  const supabase = requireWritableSupabase();

  console.log(dryRun ? "\n[DRY RUN] Resolve fingerprint collisions\n" : "\nResolve fingerprint collisions\n");

  const mergeStats = await mergeDuplicatePlacements(supabase, {
    domain: domain ?? undefined,
    dryRun,
    limit,
  });

  console.log("── Merge pass ──");
  console.log(`Groups merged:     ${mergeStats.groupsFound}`);
  console.log(`Rows folded in:    ${mergeStats.rowsMerged}`);
  console.log(`Rows deleted:      ${mergeStats.rowsDeleted}`);
  console.log(`Fingerprints set:  ${mergeStats.fingerprintsSet}`);
  if (mergeStats.errors.length) {
    console.log(`Errors (${mergeStats.errors.length}):`);
    for (const e of mergeStats.errors.slice(0, 10)) console.log(`  - ${e}`);
  }

  if (dryRun) return;

  const { updated, errors } = await backfillCanonicalFingerprints(supabase, limit);
  console.log("\n── Backfill pass ──");
  console.log(`Rows backfilled: ${updated}`);
  if (errors.length) {
    console.log(`Backfill collisions (${errors.length}) — re-run merge if needed:`);
    for (const e of errors.slice(0, 10)) console.log(`  - ${e}`);
  }

  if (domain) {
    console.log(`\nAudit: npm run data-quality:audit -- --domain ${domain}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
