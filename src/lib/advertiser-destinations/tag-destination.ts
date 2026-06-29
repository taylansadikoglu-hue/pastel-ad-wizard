/**
 * Tag advertiser_destinations with OpenAI — cached by url_hash (30-day freshness).
 */

import {
  landingSummaryFromRow,
  type LandingPageSummary,
} from "./landing-summary";
import {
  tagDestinationWithOpenAi,
  tagsFromRow,
  tagsToRowPatch,
  type DestinationAiTags,
} from "./openai-tag";
import { tagCacheStatus, type TagCacheStatus } from "./tag-cache";
import type { AdvertiserDestinationRow } from "./types";
import {
  destinationHost,
  destinationUrlHash,
  normalizeAdvertiser,
  normalizeDestinationUrl,
} from "./url";

export type TagDestinationInput = {
  advertiser: string;
  url: string;
  adCopy: string;
  landingSummary?: LandingPageSummary;
  model?: string;
  apiKey?: string;
  /** When true, never calls OpenAI — reports what would happen. */
  dryRun?: boolean;
};

export type TagDestinationResult = {
  id: number | null;
  cached: boolean;
  cache_status: TagCacheStatus;
  tags: DestinationAiTags | null;
  row: AdvertiserDestinationRow | null;
  gpt_called: boolean;
};

type SupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (col: string, val: string) => {
        not: (col: string, op: string, val: null) => {
          limit: (n: number) => {
            maybeSingle: () => Promise<{
              data: AdvertiserDestinationRow | null;
              error: { message: string } | null;
            }>;
          };
        };
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

async function findTaggedRowByUrlHash(
  supabase: SupabaseClient,
  urlHash: string,
): Promise<AdvertiserDestinationRow | null> {
  const { data, error } = await supabase
    .from("advertiser_destinations")
    .select("*")
    .eq("url_hash", urlHash)
    .not("ai_tagged_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`advertiser_destinations tag cache lookup failed: ${error.message}`);
  }

  return data;
}

export async function getDestinationTagCacheStatus(
  supabase: SupabaseClient,
  url: string,
): Promise<{ status: TagCacheStatus; row: AdvertiserDestinationRow | null; tags: DestinationAiTags | null }> {
  const normalized = normalizeDestinationUrl(url);
  if (!normalized) {
    return { status: "new", row: null, tags: null };
  }

  const row = await findTaggedRowByUrlHash(supabase, destinationUrlHash(normalized));
  if (!row?.ai_tagged_at) {
    return { status: "new", row: null, tags: null };
  }

  const status = tagCacheStatus(row.ai_tagged_at);
  const tags = tagsFromRow(row);
  return { status, row, tags };
}

export async function isDestinationUrlTagged(
  supabase: SupabaseClient,
  url: string,
): Promise<boolean> {
  const { status } = await getDestinationTagCacheStatus(supabase, url);
  return status === "fresh";
}

async function findAdvertiserRow(
  supabase: SupabaseClient,
  advertiser: string,
  urlHash: string,
): Promise<AdvertiserDestinationRow | null> {
  const { data, error } = await supabase
    .from("advertiser_destinations")
    .select("*")
    .eq("advertiser", advertiser)
    .eq("url_hash", urlHash)
    .maybeSingle();

  if (error) {
    throw new Error(`advertiser_destinations lookup failed: ${error.message}`);
  }

  return data;
}

async function applyTagsToRow(
  supabase: SupabaseClient,
  rowId: number,
  tags: DestinationAiTags,
  taggedAt: string,
): Promise<AdvertiserDestinationRow> {
  const patch = tagsToRowPatch(tags, taggedAt);

  const { data: updated, error } = await supabase
    .from("advertiser_destinations")
    .update(patch)
    .eq("id", rowId)
    .select("*")
    .single();

  if (error || !updated) {
    throw new Error(`advertiser_destinations tag update failed: ${error?.message ?? "no row"}`);
  }

  return updated;
}

async function insertTaggedRow(
  supabase: SupabaseClient,
  seed: {
    advertiser: string;
    domain: string;
    url: string;
    urlHash: string;
    landingSummary: LandingPageSummary;
  },
  tags: DestinationAiTags,
  taggedAt: string,
): Promise<AdvertiserDestinationRow> {
  const now = new Date().toISOString();
  const { data: inserted, error } = await supabase
    .from("advertiser_destinations")
    .insert({
      advertiser: seed.advertiser,
      domain: seed.domain,
      url: seed.url,
      url_hash: seed.urlHash,
      page_title: seed.landingSummary.title ?? null,
      meta_description: seed.landingSummary.meta ?? null,
      h1: seed.landingSummary.h1 ?? null,
      h2s: seed.landingSummary.h2?.length ? seed.landingSummary.h2 : null,
      visible_offers: seed.landingSummary.visibleOffers?.length ? seed.landingSummary.visibleOffers : null,
      cta: seed.landingSummary.cta ?? null,
      first_seen: now,
      last_seen: now,
      ad_count: 1,
      enrichment_status: "pending",
      ...tagsToRowPatch(tags, taggedAt),
    })
    .select("*")
    .single();

  if (error || !inserted) {
    throw new Error(`advertiser_destinations tag insert failed: ${error?.message ?? "no row"}`);
  }

  return inserted;
}

async function copyFreshCacheToAdvertiserRow(
  supabase: SupabaseClient,
  advertiserRow: AdvertiserDestinationRow | null,
  seed: {
    advertiser: string;
    domain: string;
    url: string;
    urlHash: string;
    landingSummary: LandingPageSummary;
  },
  cached: { tags: DestinationAiTags; taggedAt: string },
): Promise<AdvertiserDestinationRow> {
  if (advertiserRow) {
    return applyTagsToRow(supabase, advertiserRow.id, cached.tags, cached.taggedAt);
  }
  return insertTaggedRow(supabase, seed, cached.tags, cached.taggedAt);
}

export async function tagAndStoreDestination(
  supabase: SupabaseClient,
  input: TagDestinationInput,
): Promise<TagDestinationResult> {
  const normalizedUrl = normalizeDestinationUrl(input.url);
  if (!normalizedUrl) {
    throw new Error("A valid destination URL is required");
  }

  const advertiser = normalizeAdvertiser(input.advertiser);
  const urlHash = destinationUrlHash(normalizedUrl);
  const domain = destinationHost(normalizedUrl);

  let landingSummary = input.landingSummary ?? { url: normalizedUrl };

  const advertiserRow = await findAdvertiserRow(supabase, advertiser, urlHash);
  if (!input.landingSummary && advertiserRow) {
    landingSummary = landingSummaryFromRow(advertiserRow);
  }

  const seed = { advertiser, domain, url: normalizedUrl, urlHash, landingSummary };
  const cacheLookup = await getDestinationTagCacheStatus(supabase, normalizedUrl);

  if (cacheLookup.status === "fresh" && cacheLookup.tags && cacheLookup.row) {
    const row = await copyFreshCacheToAdvertiserRow(supabase, advertiserRow, seed, {
      tags: cacheLookup.tags,
      taggedAt: cacheLookup.row.ai_tagged_at!,
    });
    return {
      id: row.id,
      cached: true,
      cache_status: "fresh",
      tags: cacheLookup.tags,
      row,
      gpt_called: false,
    };
  }

  if (input.dryRun) {
    const status: TagCacheStatus =
      cacheLookup.status === "stale" ? "stale" : advertiserRow?.ai_tagged_at ? "stale" : "new";
    return {
      id: advertiserRow?.id ?? null,
      cached: false,
      cache_status: status,
      tags: cacheLookup.tags,
      row: advertiserRow,
      gpt_called: status === "new" || status === "stale",
    };
  }

  const tags = await tagDestinationWithOpenAi({
    adCopy: input.adCopy,
    landingSummary,
    model: input.model,
    apiKey: input.apiKey,
  });

  const taggedAt = new Date().toISOString();
  const cacheStatus: TagCacheStatus =
    cacheLookup.status === "stale" || advertiserRow?.ai_tagged_at ? "stale" : "new";

  if (advertiserRow) {
    const row = await applyTagsToRow(supabase, advertiserRow.id, tags, taggedAt);
    return {
      id: row.id,
      cached: false,
      cache_status: cacheStatus,
      tags,
      row,
      gpt_called: true,
    };
  }

  const row = await insertTaggedRow(supabase, seed, tags, taggedAt);
  return {
    id: row.id,
    cached: false,
    cache_status: "new",
    tags,
    row,
    gpt_called: true,
  };
}
