-- AdLibrary pipeline tables (candidates, enrichments, winners, health logs)

CREATE TABLE IF NOT EXISTS public.adlibrary_advertiser_candidates (
  id bigserial PRIMARY KEY,
  category text NOT NULL,
  advertiser_name text NOT NULL,
  domain text,
  platform_ids jsonb,
  ad_count integer NOT NULL DEFAULT 0,
  estimated_impressions bigint NOT NULL DEFAULT 0,
  platforms jsonb,
  sample_ads jsonb,
  confidence numeric,
  source text NOT NULL DEFAULT 'adlibrary',
  first_seen timestamptz,
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, advertiser_name)
);

CREATE INDEX IF NOT EXISTS adlibrary_candidates_category_idx
  ON public.adlibrary_advertiser_candidates (category, ad_count DESC);

CREATE TABLE IF NOT EXISTS public.adlibrary_enrichments (
  ad_key text PRIMARY KEY,
  advertiser_name text,
  platform text,
  summary text,
  transcription text,
  analysis text,
  ugc_script text,
  markdown text,
  source text,
  cached boolean NOT NULL DEFAULT false,
  raw_json jsonb,
  enriched_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS adlibrary_enrichments_advertiser_idx
  ON public.adlibrary_enrichments (advertiser_name);

CREATE TABLE IF NOT EXISTS public.adlibrary_winning_concepts (
  id bigserial PRIMARY KEY,
  advertiser_name text NOT NULL,
  page_id text NOT NULL,
  category text,
  ad_key text,
  tier text,
  composite_score numeric,
  reasons jsonb,
  variant_count integer,
  variants jsonb,
  dna_diff jsonb,
  tags jsonb,
  raw_json jsonb,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (advertiser_name, page_id, ad_key)
);

CREATE INDEX IF NOT EXISTS adlibrary_winners_advertiser_idx
  ON public.adlibrary_winning_concepts (advertiser_name, composite_score DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.adlibrary_pipeline_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  duration_ms integer,
  categories_scanned integer NOT NULL DEFAULT 0,
  advertisers_scanned integer NOT NULL DEFAULT 0,
  ads_found integer NOT NULL DEFAULT 0,
  ads_inserted integer NOT NULL DEFAULT 0,
  ads_updated integer NOT NULL DEFAULT 0,
  enrichments_requested integer NOT NULL DEFAULT 0,
  cache_hits integer NOT NULL DEFAULT 0,
  winners_scanned integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  credits_remaining integer,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'running'
);

CREATE INDEX IF NOT EXISTS adlibrary_pipeline_runs_started_idx
  ON public.adlibrary_pipeline_runs (started_at DESC);

-- Dedup index for AdLibrary placements (creative_hash stores adlibrary:{ad_key})
CREATE INDEX IF NOT EXISTS ad_placements_adlibrary_creative_hash_idx
  ON public.ad_placements (creative_hash)
  WHERE source_platform = 'adlibrary';

GRANT SELECT ON public.adlibrary_advertiser_candidates TO authenticated;
GRANT SELECT ON public.adlibrary_enrichments TO authenticated;
GRANT SELECT ON public.adlibrary_winning_concepts TO authenticated;
GRANT SELECT ON public.adlibrary_pipeline_runs TO authenticated;

GRANT ALL ON public.adlibrary_advertiser_candidates TO service_role;
GRANT ALL ON public.adlibrary_enrichments TO service_role;
GRANT ALL ON public.adlibrary_winning_concepts TO service_role;
GRANT ALL ON public.adlibrary_pipeline_runs TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.adlibrary_advertiser_candidates_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.adlibrary_winning_concepts_id_seq TO service_role;
