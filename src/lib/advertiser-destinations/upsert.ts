/**
 * Upsert helper for public.advertiser_destinations.
 * Dedupes on (advertiser, url_hash).
 */

import type {
  AdvertiserDestinationRow,
  AdvertiserDestinationUpsertInput,
  AdvertiserDestinationUpsertResult,
} from "./types";
import { normalizeAdvertiser } from "./url";

type SupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: AdvertiserDestinationRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
    insert: (row: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{
          data: AdvertiserDestinationRow | null;
          error: { message: string } | null;
        }>;
      };
    };
    update: (row: Record<string, unknown>) => {
      eq: (col: string, val: number) => {
        select: (columns: string) => {
          single: () => Promise<{
            data: AdvertiserDestinationRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
};

function normalizeAdvertiserKey(advertiser: string): string {
  return normalizeAdvertiser(advertiser);
}

function coalesceText(current: string | null, incoming?: string | null): string | null {
  if (incoming?.trim()) return incoming.trim();
  return current;
}

function minIso(a: string, b: string): string {
  return new Date(a) <= new Date(b) ? a : b;
}

function maxIso(a: string, b: string): string {
  return new Date(a) >= new Date(b) ? a : b;
}

function mergeRow(
  existing: AdvertiserDestinationRow,
  input: AdvertiserDestinationUpsertInput,
  now: string,
): Record<string, unknown> {
  const firstSeen = input.first_seen ?? now;
  const lastSeen = input.last_seen ?? now;

  return {
    page_title: coalesceText(existing.page_title, input.page_title),
    meta_description: coalesceText(existing.meta_description, input.meta_description),
    h1: coalesceText(existing.h1, input.h1),
    h2s: input.h2s?.length ? input.h2s : existing.h2s,
    visible_offers: input.visible_offers?.length ? input.visible_offers : existing.visible_offers,
    product: coalesceText(existing.product, input.product),
    offer: coalesceText(existing.offer, input.offer),
    cta: coalesceText(existing.cta, input.cta),
    persona: coalesceText(existing.persona, input.persona),
    audience: coalesceText(existing.audience, input.audience),
    theme: coalesceText(existing.theme, input.theme),
    funnel_stage: coalesceText(existing.funnel_stage, input.funnel_stage),
    campaign_objective: coalesceText(existing.campaign_objective, input.campaign_objective),
    promise: coalesceText(existing.promise, input.promise),
    pain_point: coalesceText(existing.pain_point, input.pain_point),
    proof_point: coalesceText(existing.proof_point, input.proof_point),
    enrichment_status: input.enrichment_status ?? existing.enrichment_status,
    enriched_at: input.enriched_at ?? existing.enriched_at,
    raw_snapshot: input.raw_snapshot ?? existing.raw_snapshot,
    audience: coalesceText(existing.audience, input.audience),
    campaign_objective: coalesceText(existing.campaign_objective, input.campaign_objective),
    promise: coalesceText(existing.promise, input.promise),
    pain_point: coalesceText(existing.pain_point, input.pain_point),
    proof_point: coalesceText(existing.proof_point, input.proof_point),
    ai_tags: input.ai_tags ?? existing.ai_tags,
    ai_tagged_at: input.ai_tagged_at ?? existing.ai_tagged_at,
    first_seen: minIso(existing.first_seen, firstSeen),
    last_seen: maxIso(existing.last_seen, lastSeen),
    ad_count: existing.ad_count + 1,
  };
}

export async function upsertAdvertiserDestination(
  supabase: SupabaseClient,
  input: AdvertiserDestinationUpsertInput,
): Promise<AdvertiserDestinationUpsertResult> {
  const advertiser = normalizeAdvertiserKey(input.advertiser);
  const now = new Date().toISOString();

  const { data: existing, error: findErr } = await supabase
    .from("advertiser_destinations")
    .select("*")
    .eq("advertiser", advertiser)
    .eq("url_hash", input.url_hash)
    .maybeSingle();

  if (findErr) {
    throw new Error(`advertiser_destinations lookup failed: ${findErr.message}`);
  }

  if (existing) {
    const { data: updated, error: updErr } = await supabase
      .from("advertiser_destinations")
      .update(mergeRow(existing, input, now))
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updErr || !updated) {
      throw new Error(`advertiser_destinations update failed: ${updErr?.message ?? "no row"}`);
    }

    return { id: updated.id, action: "updated", row: updated };
  }

  const insertRow = {
    advertiser,
    domain: input.domain,
    url: input.url,
    url_hash: input.url_hash,
    page_title: input.page_title ?? null,
    meta_description: input.meta_description ?? null,
    h1: input.h1 ?? null,
    h2s: input.h2s ?? null,
    visible_offers: input.visible_offers ?? null,
    product: input.product ?? null,
    offer: input.offer ?? null,
    cta: input.cta ?? null,
    persona: input.persona ?? null,
    audience: input.audience ?? null,
    theme: input.theme ?? null,
    funnel_stage: input.funnel_stage ?? null,
    campaign_objective: input.campaign_objective ?? null,
    promise: input.promise ?? null,
    pain_point: input.pain_point ?? null,
    proof_point: input.proof_point ?? null,
    enrichment_status: input.enrichment_status ?? "pending",
    enriched_at: input.enriched_at ?? null,
    raw_snapshot: input.raw_snapshot ?? null,
    ai_tags: input.ai_tags ?? null,
    ai_tagged_at: input.ai_tagged_at ?? null,
    first_seen: input.first_seen ?? now,
    last_seen: input.last_seen ?? now,
    ad_count: 1,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("advertiser_destinations")
    .insert(insertRow)
    .select("*")
    .single();

  if (insErr || !inserted) {
    throw new Error(`advertiser_destinations insert failed: ${insErr?.message ?? "no row"}`);
  }

  return { id: inserted.id, action: "inserted", row: inserted };
}

export * from "./types";
