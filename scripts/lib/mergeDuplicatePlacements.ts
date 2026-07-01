/**
 * Merge duplicate ad_placements rows sharing the same canonical fingerprint.
 * Run after backfill when unique constraint blocks fingerprint assignment.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fingerprintFromPlacementRow } from "../../src/lib/placementFingerprint.ts";
import { mergePlacementRow } from "./adlibraryPlacementUpsert.ts";

const ENRICHMENT_FIELDS = [
  "strategist_takeaway",
  "hook_analysis",
  "primary_cta",
  "emotional_driver",
  "buyer_stage",
  "product_type",
  "market_signal",
  "offer_signal",
  "campaign_cluster",
] as const;

export type MergeDuplicateStats = {
  groupsFound: number;
  rowsMerged: number;
  rowsDeleted: number;
  fingerprintsSet: number;
  errors: string[];
};

function richnessScore(row: Record<string, unknown>): number {
  let score = 0;
  for (const field of ENRICHMENT_FIELDS) {
    const v = row[field];
    if (v != null && String(v).trim() && !/^(unknown|other|unspecified|none)$/i.test(String(v))) {
      score += 1;
    }
  }
  if (row.media_url || row.creative_url) score += 2;
  if (row.last_seen) score += 1;
  return score;
}

function groupKey(row: Record<string, unknown>): string {
  const domain = String(row.domain ?? "").toLowerCase();
  const fp =
    (row.canonical_fingerprint as string | null) ??
    (row.creative_hash as string | null) ??
    fingerprintFromPlacementRow(row);
  return `${domain}::${fp}`;
}

export async function mergeDuplicatePlacements(
  supabase: SupabaseClient,
  options: { domain?: string; dryRun?: boolean; limit?: number } = {},
): Promise<MergeDuplicateStats> {
  const { domain, dryRun = false, limit = 5000 } = options;
  const stats: MergeDuplicateStats = {
    groupsFound: 0,
    rowsMerged: 0,
    rowsDeleted: 0,
    fingerprintsSet: 0,
    errors: [],
  };

  let query = supabase.from("ad_placements").select("*").limit(limit);
  if (domain) query = query.ilike("domain", `%${domain}%`);

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows ?? []) {
    const r = row as Record<string, unknown>;
    const key = groupKey(r);
    const bucket = groups.get(key) ?? [];
    bucket.push(r);
    groups.set(key, bucket);
  }

  for (const [, groupRows] of groups) {
    if (groupRows.length <= 1) {
      const solo = groupRows[0];
      const fp = fingerprintFromPlacementRow(solo);
      if (!solo.canonical_fingerprint && fp && !dryRun) {
        const { error: upErr } = await supabase
          .from("ad_placements")
          .update({ canonical_fingerprint: fp })
          .eq("id", solo.id as number);
        if (upErr) stats.errors.push(`solo ${solo.id}: ${upErr.message}`);
        else stats.fingerprintsSet++;
      }
      continue;
    }

    stats.groupsFound++;
    const sorted = [...groupRows].sort(
      (a, b) => richnessScore(b) - richnessScore(a) || Number(b.id) - Number(a.id),
    );
    const keeper = sorted[0];
    const dupes = sorted.slice(1);
    const canonicalFingerprint = fingerprintFromPlacementRow(keeper);

    let merged = { ...keeper };
    for (const dupe of dupes) {
      merged = mergePlacementRow(merged, dupe);
      stats.rowsMerged++;
    }
    merged.canonical_fingerprint = canonicalFingerprint;

    if (dryRun) {
      stats.rowsDeleted += dupes.length;
      continue;
    }

    const { error: updateErr } = await supabase
      .from("ad_placements")
      .update(merged)
      .eq("id", keeper.id as number);
    if (updateErr) {
      stats.errors.push(`keeper ${keeper.id}: ${updateErr.message}`);
      continue;
    }
    stats.fingerprintsSet++;

    for (const dupe of dupes) {
      const dupeId = dupe.id as number;
      const keeperId = keeper.id as number;

      await supabase
        .from("placement_sources")
        .update({ placement_id: keeperId })
        .eq("placement_id", dupeId);

      const { error: delErr } = await supabase.from("ad_placements").delete().eq("id", dupeId);
      if (delErr) stats.errors.push(`delete ${dupeId}: ${delErr.message}`);
      else stats.rowsDeleted++;
    }
  }

  return stats;
}
