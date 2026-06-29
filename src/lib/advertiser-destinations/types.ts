/** Row shape for public.advertiser_destinations. */

export type AdvertiserDestinationRow = {
  id: number;
  advertiser: string;
  domain: string;
  url: string;
  url_hash: string;
  page_title: string | null;
  product: string | null;
  offer: string | null;
  cta: string | null;
  persona: string | null;
  theme: string | null;
  funnel_stage: string | null;
  first_seen: string;
  last_seen: string;
  ad_count: number;
  created_at: string;
  updated_at: string;
};

export type AdvertiserDestinationUpsertInput = {
  advertiser: string;
  domain: string;
  url: string;
  url_hash: string;
  page_title?: string | null;
  product?: string | null;
  offer?: string | null;
  cta?: string | null;
  persona?: string | null;
  theme?: string | null;
  funnel_stage?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
};

export type AdvertiserDestinationUpsertResult = {
  id: number;
  action: "inserted" | "updated";
  row: AdvertiserDestinationRow;
};
