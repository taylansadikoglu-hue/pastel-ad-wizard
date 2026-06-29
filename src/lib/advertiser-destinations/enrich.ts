/**
 * Fetch landing page signals and persist to advertiser_destinations.
 */

import { extractLandingPage, type LandingPageExtraction } from "./extract-landing-page";
import type { AdvertiserDestinationRow, DestinationEnrichmentStatus } from "./types";
import {
  destinationHost,
  destinationUrlHash,
  normalizeAdvertiser,
  normalizeDestinationUrl,
} from "./url";

export type EnrichDestinationInput = {
  advertiser: string;
  url: string;
};

export type EnrichDestinationResult = {
  id: number;
  action: "inserted" | "updated";
  enrichment_status: DestinationEnrichmentStatus;
  extraction: LandingPageExtraction;
  row: AdvertiserDestinationRow;
};

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

function enrichmentPatch(
  extraction: LandingPageExtraction,
  status: DestinationEnrichmentStatus,
): Record<string, unknown> {
  const primaryOffer = extraction.visibleOffers[0] ?? null;

  return {
    page_title: extraction.title,
    meta_description: extraction.meta,
    h1: extraction.h1,
    h2s: extraction.h2.length ? extraction.h2 : null,
    visible_offers: extraction.visibleOffers.length ? extraction.visibleOffers : null,
    product: extraction.h1,
    offer: primaryOffer,
    cta: extraction.cta,
    enrichment_status: status,
    enriched_at: new Date().toISOString(),
    raw_snapshot: extraction,
    last_seen: new Date().toISOString(),
  };
}

export function mapExtractionToDestinationFields(extraction: LandingPageExtraction) {
  return enrichmentPatch(extraction, "ready");
}

export async function enrichAndStoreDestination(
  supabase: SupabaseClient,
  input: EnrichDestinationInput,
): Promise<EnrichDestinationResult> {
  const normalizedUrl = normalizeDestinationUrl(input.url);
  if (!normalizedUrl) {
    throw new Error("A valid destination URL is required");
  }

  const advertiser = normalizeAdvertiser(input.advertiser);
  const urlHash = destinationUrlHash(normalizedUrl);
  const domain = destinationHost(normalizedUrl);
  const now = new Date().toISOString();

  let extraction: LandingPageExtraction;
  try {
    extraction = await extractLandingPage(normalizedUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Landing page extraction failed: ${message}`);
  }

  const { data: existing, error: findErr } = await supabase
    .from("advertiser_destinations")
    .select("*")
    .eq("advertiser", advertiser)
    .eq("url_hash", urlHash)
    .maybeSingle();

  if (findErr) {
    throw new Error(`advertiser_destinations lookup failed: ${findErr.message}`);
  }

  const patch = enrichmentPatch(extraction, "ready");

  if (existing) {
    const { data: updated, error: updErr } = await supabase
      .from("advertiser_destinations")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updErr || !updated) {
      throw new Error(`advertiser_destinations enrichment update failed: ${updErr?.message ?? "no row"}`);
    }

    return {
      id: updated.id,
      action: "updated",
      enrichment_status: "ready",
      extraction,
      row: updated,
    };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("advertiser_destinations")
    .insert({
      advertiser,
      domain,
      url: normalizedUrl,
      url_hash: urlHash,
      first_seen: now,
      last_seen: now,
      ad_count: 1,
      ...patch,
    })
    .select("*")
    .single();

  if (insErr || !inserted) {
    throw new Error(`advertiser_destinations enrichment insert failed: ${insErr?.message ?? "no row"}`);
  }

  return {
    id: inserted.id,
    action: "inserted",
    enrichment_status: "ready",
    extraction,
    row: inserted,
  };
}
