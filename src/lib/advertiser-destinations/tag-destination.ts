/**
 * Tag advertiser_destinations with OpenAI — cached by url_hash.
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
};

export type TagDestinationResult = {
  id: number;
  cached: boolean;
  tags: DestinationAiTags;
  row: AdvertiserDestinationRow;
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

async function findCachedTagsByUrl(
  supabase: SupabaseClient,
  urlHash: string,
): Promise<{ tags: DestinationAiTags; row: AdvertiserDestinationRow } | null> {
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
  if (!data) return null;

  const tags = tagsFromRow(data);
  if (!tags) return null;

  return { tags, row: data };
}

export async function isDestinationUrlTagged(
  supabase: SupabaseClient,
  url: string,
): Promise<boolean> {
  const normalized = normalizeDestinationUrl(url);
  if (!normalized) return false;
  const cached = await findCachedTagsByUrl(supabase, destinationUrlHash(normalized));
  return Boolean(cached);
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

  const cached = await findCachedTagsByUrl(supabase, urlHash);
  if (cached) {
    if (advertiserRow?.ai_tagged_at) {
      const tags = tagsFromRow(advertiserRow) ?? cached.tags;
      return { id: advertiserRow.id, cached: true, tags, row: advertiserRow };
    }

    if (advertiserRow) {
      const row = await applyTagsToRow(supabase, advertiserRow.id, cached.tags, cached.row.ai_tagged_at!);
      return { id: row.id, cached: true, tags: cached.tags, row };
    }

    const row = await insertTaggedRow(
      supabase,
      { advertiser, domain, url: normalizedUrl, urlHash, landingSummary },
      cached.tags,
      cached.row.ai_tagged_at!,
    );
    return { id: row.id, cached: true, tags: cached.tags, row };
  }

  if (advertiserRow?.ai_tagged_at) {
    const tags = tagsFromRow(advertiserRow);
    if (tags) {
      return { id: advertiserRow.id, cached: true, tags, row: advertiserRow };
    }
  }

  const tags = await tagDestinationWithOpenAi({
    adCopy: input.adCopy,
    landingSummary,
    model: input.model,
    apiKey: input.apiKey,
  });

  const taggedAt = new Date().toISOString();

  if (advertiserRow) {
    const row = await applyTagsToRow(supabase, advertiserRow.id, tags, taggedAt);
    return { id: row.id, cached: false, tags, row };
  }

  const row = await insertTaggedRow(
    supabase,
    { advertiser, domain, url: normalizedUrl, urlHash, landingSummary },
    tags,
    taggedAt,
  );

  return { id: row.id, cached: false, tags, row };
}
