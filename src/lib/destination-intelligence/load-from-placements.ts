/**
 * Bridge ad_placements rows → destination enrichment input (no new APIs).
 */

import type { AdWithDestination, AdvertiserDestinationRow } from "./types";

/** Map a Supabase ad_placements row into enrichment input. */
export function placementToAdWithDestination(
  placement: Record<string, unknown>,
): AdWithDestination {
  return {
    advertiser: typeof placement.advertiser_name === "string" ? placement.advertiser_name : null,
    domain: typeof placement.domain === "string" ? placement.domain : null,
    landing_url: typeof placement.landing_url === "string" ? placement.landing_url : null,
    page_title: typeof placement.page_title === "string" ? placement.page_title : null,
    page_description: typeof placement.page_description === "string" ? placement.page_description : null,
    primary_cta: typeof placement.primary_cta === "string" ? placement.primary_cta : null,
    detected_cta: typeof placement.detected_cta === "string" ? placement.detected_cta : null,
    extracted_offer: typeof placement.extracted_offer === "string" ? placement.extracted_offer : null,
    offer_signal: typeof placement.offer_signal === "string" ? placement.offer_signal : null,
    offer_theme: typeof placement.offer_theme === "string" ? placement.offer_theme : null,
    offer_type: typeof placement.offer_type === "string" ? placement.offer_type : null,
    buyer_stage: typeof placement.buyer_stage === "string" ? placement.buyer_stage : null,
    product_type: typeof placement.product_type === "string" ? placement.product_type : null,
    product_category: typeof placement.product_category === "string" ? placement.product_category : null,
    emotional_driver: typeof placement.emotional_driver === "string" ? placement.emotional_driver : null,
    advertiser_name: typeof placement.advertiser_name === "string" ? placement.advertiser_name : null,
    first_seen: typeof placement.first_seen === "string" ? placement.first_seen : null,
    last_seen: typeof placement.last_seen === "string" ? placement.last_seen : null,
    ai_tags: placement.ai_tags as AdWithDestination["ai_tags"],
  };
}

type SupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (col: string, val: string) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{
          data: AdvertiserDestinationRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

/** Load persisted destination catalog for an advertiser (when table is populated). */
export async function loadDestinationsForAdvertiser(
  supabase: SupabaseClient,
  advertiserDomain: string,
): Promise<AdvertiserDestinationRow[]> {
  const key = advertiserDomain.toLowerCase().replace(/^www\./, "");
  const { data, error } = await supabase
    .from("advertiser_destinations")
    .select("*")
    .eq("advertiser", key)
    .order("last_seen", { ascending: false });

  if (error || !data) return [];
  return data;
}
