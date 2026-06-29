/**
 * Merge extracted destinations into deduplicated catalog rows (worker-ready).
 */

import type {
  AdvertiserDestinationInsert,
  AdvertiserDestinationRow,
  ExtractedDestination,
} from "./types";

function minIso(a: string | null, b: string | null): string {
  if (!a) return b ?? new Date().toISOString();
  if (!b) return a;
  return new Date(a) <= new Date(b) ? a : b;
}

function maxIso(a: string | null, b: string | null): string {
  if (!a) return b ?? new Date().toISOString();
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
}

function coalesceField(current: string | null, incoming: string | null): string | null {
  if (incoming?.trim()) return incoming.trim();
  return current;
}

export function mergeDestinationRow(
  existing: AdvertiserDestinationRow,
  incoming: ExtractedDestination,
): AdvertiserDestinationRow {
  return {
    ...existing,
    page_title: coalesceField(existing.page_title, incoming.page_title),
    product: coalesceField(existing.product, incoming.product),
    offer: coalesceField(existing.offer, incoming.offer),
    cta: coalesceField(existing.cta, incoming.cta),
    persona: coalesceField(existing.persona, incoming.persona),
    theme: coalesceField(existing.theme, incoming.theme),
    funnel_stage: coalesceField(existing.funnel_stage, incoming.funnel_stage),
    first_seen: minIso(existing.first_seen, incoming.first_seen),
    last_seen: maxIso(existing.last_seen, incoming.last_seen),
    ad_count: existing.ad_count + 1,
    enrichment_status:
      existing.enrichment_status === "ready" ? "ready" : existing.enrichment_status,
  };
}

export function destinationInsertFromExtraction(
  extracted: ExtractedDestination,
): AdvertiserDestinationInsert {
  const now = new Date().toISOString();
  return {
    advertiser: extracted.advertiser,
    domain: extracted.domain,
    url: extracted.url,
    url_hash: extracted.url_hash,
    page_title: extracted.page_title,
    product: extracted.product,
    offer: extracted.offer,
    cta: extracted.cta,
    persona: extracted.persona,
    theme: extracted.theme,
    funnel_stage: extracted.funnel_stage,
    first_seen: extracted.first_seen ?? now,
    last_seen: extracted.last_seen ?? now,
    ad_count: 1,
    enrichment_status: "pending",
    enriched_at: null,
    raw_snapshot: null,
  };
}

export function upsertDestinationCatalog(
  catalog: AdvertiserDestinationRow[],
  extractions: ExtractedDestination[],
): AdvertiserDestinationRow[] {
  const byKey = new Map<string, AdvertiserDestinationRow>();
  for (const row of catalog) {
    byKey.set(`${row.advertiser}::${row.url_hash}`, row);
  }

  let nextId = Math.max(0, ...catalog.map((r) => r.id)) + 1;

  for (const ext of extractions) {
    const key = `${ext.advertiser}::${ext.url_hash}`;
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, mergeDestinationRow(existing, ext));
    } else {
      const insert = destinationInsertFromExtraction(ext);
      byKey.set(key, {
        ...insert,
        id: nextId++,
        created_at: insert.first_seen,
        updated_at: insert.last_seen,
      });
    }
  }

  return [...byKey.values()].sort(
    (a, b) => b.ad_count - a.ad_count || b.last_seen.localeCompare(a.last_seen),
  );
}
