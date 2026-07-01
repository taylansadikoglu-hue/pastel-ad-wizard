/**
 * Unified placement ingest — use in AdLibrary scripts, PM2 workers, and /api/ingest.
 *
 *   import { ingestPlacementRow } from "./lib/ingestPlacement.ts";
 *   const { result, skipped, reason } = await ingestPlacementRow(supabase, row);
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fingerprintFromPlacementRow,
  normalizeDomain,
  resolveChannelBucket,
  shouldSkipRedundantSource,
  type SourcePlatform,
} from "../../src/lib/placementFingerprint.ts";
import {
  upsertCanonicalPlacement,
  type CanonicalUpsertResult,
} from "./canonicalPlacementUpsert.ts";

export type IngestPlacementResult = {
  result: CanonicalUpsertResult | "skipped";
  skipped: boolean;
  reason?: string;
};

function asSourcePlatform(value: unknown): SourcePlatform {
  const v = String(value ?? "adlibrary").toLowerCase();
  if (v === "dataforseo" || v === "apify" || v === "adlibrary") return v;
  return "adlibrary";
}

/** Normalize incoming row before fingerprint + upsert. */
export function preparePlacementRow(row: Record<string, unknown>): Record<string, unknown> {
  const prepared = { ...row };
  if (prepared.domain) {
    prepared.domain = normalizeDomain(String(prepared.domain));
  }
  prepared.source_platform = asSourcePlatform(prepared.source_platform);
  prepared.canonical_fingerprint =
    (prepared.canonical_fingerprint as string | null) ?? fingerprintFromPlacementRow(prepared);
  return prepared;
}

async function loadExistingSourcePlatforms(
  supabase: SupabaseClient,
  placementId: number,
  fallbackSource: SourcePlatform,
): Promise<SourcePlatform[]> {
  const sources = new Set<SourcePlatform>([fallbackSource]);

  const { data: receipts } = await supabase
    .from("placement_sources")
    .select("source_platform")
    .eq("placement_id", placementId);

  for (const row of receipts ?? []) {
    sources.add(asSourcePlatform(row.source_platform));
  }

  return [...sources];
}

async function findPlacementIdByFingerprint(
  supabase: SupabaseClient,
  domain: string,
  canonicalFingerprint: string,
): Promise<number | null> {
  const root = normalizeDomain(domain);
  const { data } = await supabase
    .from("ad_placements")
    .select("id")
    .eq("canonical_fingerprint", canonicalFingerprint)
    .ilike("domain", `%${root.split(".")[0]}%`)
    .limit(1)
    .maybeSingle();

  return data?.id != null ? (data.id as number) : null;
}

/**
 * Ingest one placement row with canonical dedup + source authority skip.
 */
export async function ingestPlacementRow(
  supabase: SupabaseClient | null,
  incomingRow: Record<string, unknown>,
  dryRun = false,
): Promise<IngestPlacementResult> {
  const row = preparePlacementRow(incomingRow);
  const sourcePlatform = asSourcePlatform(row.source_platform);
  const channel = resolveChannelBucket({
    domain: String(row.domain ?? ""),
    channel: row.channel as string | null,
    channelPlatform: row.channel_platform as string | null,
  });
  const fingerprint = String(row.canonical_fingerprint ?? "");

  if (supabase && !dryRun && fingerprint) {
    const existingId = await findPlacementIdByFingerprint(
      supabase,
      String(row.domain ?? ""),
      fingerprint,
    );

    if (existingId) {
      const { data: existingRow } = await supabase
        .from("ad_placements")
        .select("source_platform")
        .eq("id", existingId)
        .maybeSingle();

      const existingSources = await loadExistingSourcePlatforms(
        supabase,
        existingId,
        asSourcePlatform(existingRow?.source_platform),
      );

      if (shouldSkipRedundantSource(channel, sourcePlatform, existingSources)) {
        return {
          result: "skipped",
          skipped: true,
          reason: `${sourcePlatform} redundant for ${channel} — ${existingSources.join(", ")} owns channel`,
        };
      }
    }
  }

  const result = await upsertCanonicalPlacement(supabase, row, dryRun);
  return { result, skipped: false };
}

/** Batch ingest with stats — for worker loops. */
export async function ingestPlacementBatch(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  dryRun = false,
): Promise<{
  inserted: number;
  updated: number;
  merged: number;
  skipped: number;
  errors: string[];
}> {
  const stats = { inserted: 0, updated: 0, merged: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    try {
      const { result, skipped } = await ingestPlacementRow(supabase, row, dryRun);
      if (skipped || result === "skipped") stats.skipped++;
      else if (result === "inserted") stats.inserted++;
      else if (result === "merged") stats.merged++;
      else if (result === "updated") stats.updated++;
    } catch (err) {
      stats.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return stats;
}
