/**
 * Canonical placement upsert — shared by AdLibrary scripts and /api/ingest worker.
 *
 * Before insert: compute canonical_fingerprint, lookup existing row, merge or skip.
 * Records source receipt in placement_sources junction table.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeCanonicalFingerprint,
  fingerprintFromPlacementRow,
  normalizeDomain,
  sourceNativeIdFromRow,
  type SourcePlatform,
} from "../../src/lib/placementFingerprint.ts";
import { mergePlacementRow } from "./adlibraryPlacementUpsert.ts";

export type CanonicalUpsertResult = "inserted" | "updated" | "merged" | "skipped";

export type CanonicalUpsertStats = {
  inserted: number;
  updated: number;
  merged: number;
  skipped: number;
};

async function findExistingPlacement(
  supabase: SupabaseClient,
  domain: string,
  canonicalFingerprint: string,
  legacyCreativeHash: string | null,
): Promise<Record<string, unknown> | null> {
  const root = normalizeDomain(domain);

  const { data: byCanonical } = await supabase
    .from("ad_placements")
    .select("*")
    .eq("canonical_fingerprint", canonicalFingerprint)
    .maybeSingle();

  if (byCanonical) return byCanonical as Record<string, unknown>;

  if (legacyCreativeHash) {
    const { data: byLegacy } = await supabase
      .from("ad_placements")
      .select("*")
      .eq("creative_hash", legacyCreativeHash)
      .maybeSingle();
    if (byLegacy) return byLegacy as Record<string, unknown>;
  }

  const { data: byDomainHash } = await supabase
    .from("ad_placements")
    .select("*")
    .ilike("domain", `%${root.split(".")[0]}%`)
    .eq("canonical_fingerprint", canonicalFingerprint)
    .limit(1)
    .maybeSingle();

  return (byDomainHash as Record<string, unknown> | null) ?? null;
}

async function upsertSourceReceipt(
  supabase: SupabaseClient,
  placementId: number,
  sourcePlatform: SourcePlatform,
  sourceNativeId: string,
): Promise<void> {
  const { error } = await supabase.from("placement_sources").upsert(
    {
      placement_id: placementId,
      source_platform: sourcePlatform,
      source_native_id: sourceNativeId,
      ingested_at: new Date().toISOString(),
    },
    { onConflict: "placement_id,source_platform,source_native_id" },
  );
  if (error) {
    console.warn(`[placement_sources] receipt failed: ${error.message}`);
  }
}

export async function upsertCanonicalPlacement(
  supabase: SupabaseClient | null,
  row: Record<string, unknown>,
  dryRun: boolean,
): Promise<CanonicalUpsertResult> {
  const sourcePlatform = (row.source_platform as SourcePlatform) ?? "adlibrary";
  const canonicalFingerprint =
    (row.canonical_fingerprint as string | null) ?? fingerprintFromPlacementRow(row);
  const legacyHash = row.creative_hash as string | null;
  const domain = String(row.domain ?? "");

  row.canonical_fingerprint = canonicalFingerprint;
  if (!row.creative_hash && canonicalFingerprint) {
    row.creative_hash = legacyHash ?? canonicalFingerprint;
  }

  if (dryRun) return "inserted";
  if (!supabase) throw new Error("Supabase client required for non-dry-run upsert");

  const existing = await findExistingPlacement(supabase, domain, canonicalFingerprint, legacyHash);

  if (!existing) {
    const { data: inserted, error: insertErr } = await supabase
      .from("ad_placements")
      .insert(row)
      .select("id")
      .single();
    if (insertErr) throw new Error(`Placement insert failed: ${insertErr.message}`);

    const nativeId = sourceNativeIdFromRow(row, sourcePlatform);
    if (nativeId && inserted?.id) {
      await upsertSourceReceipt(supabase, inserted.id as number, sourcePlatform, nativeId);
    }
    return "inserted";
  }

  const patch = mergePlacementRow(existing, row);
  patch.canonical_fingerprint = canonicalFingerprint;

  const { error: updateErr } = await supabase
    .from("ad_placements")
    .update(patch)
    .eq("id", (existing as { id: number }).id);

  if (updateErr) throw new Error(`Placement update failed: ${updateErr.message}`);

  const nativeId = sourceNativeIdFromRow(row, sourcePlatform);
  if (nativeId) {
    await upsertSourceReceipt(supabase, (existing as { id: number }).id, sourcePlatform, nativeId);
  }

  const hadSameSource = (existing.source_platform as string) === sourcePlatform;
  return hadSameSource ? "updated" : "merged";
}

/** Backfill canonical_fingerprint for rows missing it. */
export async function backfillCanonicalFingerprints(
  supabase: SupabaseClient,
  limit = 500,
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  const { data: rows, error } = await supabase
    .from("ad_placements")
    .select("*")
    .is("canonical_fingerprint", null)
    .limit(limit);

  if (error) throw new Error(error.message);

  for (const row of rows ?? []) {
    const fp = fingerprintFromPlacementRow(row as Record<string, unknown>);
    const { error: upErr } = await supabase
      .from("ad_placements")
      .update({ canonical_fingerprint: fp })
      .eq("id", (row as { id: number }).id);
    if (upErr) {
      if (upErr.message.includes("duplicate") || upErr.code === "23505") {
        errors.push(`id ${(row as { id: number }).id}: duplicate fingerprint — run npm run data-quality:merge-dupes`);
      } else {
        errors.push(`id ${(row as { id: number }).id}: ${upErr.message}`);
      }
    } else updated++;
  }

  return { updated, errors };
}
