#!/usr/bin/env npx tsx
/**
 * Null junk AI tags on placements (Unknown, Other, generic CTAs).
 * Run after enrich or when audit pass 5 fails.
 *
 * npm run data-quality:sanitize-tags -- --domain commbank.com.au
 * npm run data-quality:sanitize-tags -- --dry-run
 */
import { isGenericCta, isSkipTagValue } from "../src/lib/soWhatQuality.ts";
import { argBool, argString, parseArgs } from "./lib/parseArgs.ts";
import { requireWritableSupabase } from "./lib/supabaseAdmin.ts";

const TAG_FIELDS = [
  "emotional_driver",
  "primary_cta",
  "detected_cta",
  "buyer_stage",
  "product_type",
  "campaign_cluster",
  "offer_type",
  "product_category",
] as const;

const NARRATIVE_FIELDS = [
  "strategist_takeaway",
  "hook_analysis",
  "market_signal",
  "offer_signal",
] as const;

function shouldClearTag(field: string, value: unknown): boolean {
  if (value == null || String(value).trim() === "") return false;
  const text = String(value);
  if (isSkipTagValue(text)) return true;
  if ((field === "primary_cta" || field === "detected_cta") && isGenericCta(text)) return true;
  if (NARRATIVE_FIELDS.includes(field as (typeof NARRATIVE_FIELDS)[number])) {
    if (/^this (ad|campaign|creative) (aims|seeks)/i.test(text)) return true;
    if (/^the (brand|advertiser) is (trying|aiming)/i.test(text)) return true;
    if (/^commonwealth bank/i.test(text) && text.length < 120) return true;
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv);
  const domain = argString(args, "domain");
  const dryRun = argBool(args, "dryRun");
  const limit = Number(argString(args, "limit") ?? "500");

  const supabase = requireWritableSupabase();

  let query = supabase
    .from("ad_placements")
    .select([...TAG_FIELDS, ...NARRATIVE_FIELDS, "id", "domain"].join(","))
    .limit(limit);

  if (domain) {
    const root = domain.split(".")[0] ?? domain;
    query = query.or(`domain.ilike.%${root}%,domain.ilike.%${domain}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rowsScanned = 0;
  let rowsUpdated = 0;
  let fieldsCleared = 0;

  for (const row of data ?? []) {
    rowsScanned++;
    const patch: Record<string, null> = {};
    const record = row as Record<string, unknown>;

    for (const field of [...TAG_FIELDS, ...NARRATIVE_FIELDS]) {
      if (shouldClearTag(field, record[field])) {
        patch[field] = null;
        fieldsCleared++;
      }
    }

    if (!Object.keys(patch).length) continue;

    rowsUpdated++;
    if (dryRun) {
      console.log(`[dry-run] row ${record.id} (${record.domain}): clear ${Object.keys(patch).join(", ")}`);
      continue;
    }

    const { error: upErr } = await supabase
      .from("ad_placements")
      .update(patch)
      .eq("id", record.id);
    if (upErr) console.warn(`row ${record.id}: ${upErr.message}`);
  }

  console.log(
    dryRun ? "\n[DRY RUN] Sanitize placement tags\n" : "\nSanitize placement tags\n",
  );
  console.log(`Rows scanned:  ${rowsScanned}`);
  console.log(`Rows updated:  ${rowsUpdated}`);
  console.log(`Fields cleared: ${fieldsCleared}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
