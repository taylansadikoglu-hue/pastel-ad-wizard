-- Canonical placement deduplication across AdLibrary, DataForSEO, Apify ingest paths.

-- 1. Canonical fingerprint on ad_placements
ALTER TABLE public.ad_placements
  ADD COLUMN IF NOT EXISTS canonical_fingerprint text;

COMMENT ON COLUMN public.ad_placements.canonical_fingerprint IS
  'Cross-source dedup key: can:{channel}:{domain}:{creative_signature}. All ingest paths must set this before insert.';

-- Backfill from existing creative_hash (AdLibrary rows)
UPDATE public.ad_placements
SET canonical_fingerprint = creative_hash
WHERE canonical_fingerprint IS NULL
  AND creative_hash IS NOT NULL
  AND creative_hash LIKE 'adlibrary:%';

CREATE INDEX IF NOT EXISTS ad_placements_canonical_fingerprint_idx
  ON public.ad_placements (canonical_fingerprint)
  WHERE canonical_fingerprint IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ad_placements_domain_canonical_uidx
  ON public.ad_placements (lower(domain), canonical_fingerprint)
  WHERE canonical_fingerprint IS NOT NULL;

-- 2. Source receipts — one canonical row, many ingest sources
CREATE TABLE IF NOT EXISTS public.placement_sources (
  id bigserial PRIMARY KEY,
  placement_id bigint NOT NULL REFERENCES public.ad_placements(id) ON DELETE CASCADE,
  source_platform text NOT NULL CHECK (source_platform IN ('adlibrary', 'dataforseo', 'apify')),
  source_native_id text NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (placement_id, source_platform, source_native_id)
);

CREATE INDEX IF NOT EXISTS placement_sources_placement_idx
  ON public.placement_sources (placement_id);

CREATE INDEX IF NOT EXISTS placement_sources_platform_idx
  ON public.placement_sources (source_platform, source_native_id);

GRANT SELECT ON public.placement_sources TO authenticated;
GRANT ALL ON public.placement_sources TO service_role;

-- 3. Deduped read view — one row per canonical creative per domain
CREATE OR REPLACE VIEW public.normalized_ad_placements AS
WITH ranked AS (
  SELECT
    ap.*,
    COALESCE(
      NULLIF(TRIM(ap.product_type), ''),
      NULLIF(TRIM(ap.campaign_cluster), ''),
      NULLIF(TRIM(ap.product_category), '')
    ) AS normalized_product,
    ROW_NUMBER() OVER (
      PARTITION BY
        lower(COALESCE(ap.domain, '')),
        COALESCE(
          ap.canonical_fingerprint,
          ap.creative_hash,
          'row:' || ap.id::text
        )
      ORDER BY
        (CASE WHEN ap.strategist_takeaway IS NOT NULL AND length(trim(ap.strategist_takeaway)) > 20 THEN 1 ELSE 0 END) DESC,
        (CASE WHEN ap.hook_analysis IS NOT NULL AND length(trim(ap.hook_analysis)) > 10 THEN 1 ELSE 0 END) DESC,
        (CASE WHEN ap.primary_cta IS NOT NULL AND lower(trim(ap.primary_cta)) NOT IN ('unspecified', 'unknown', 'other') THEN 1 ELSE 0 END) DESC,
        ap.last_seen DESC NULLS LAST,
        ap.times_seen DESC NULLS LAST,
        ap.id DESC
    ) AS _dedup_rank
  FROM public.ad_placements ap
)
SELECT
  id,
  advertiser_name,
  domain,
  ad_title,
  channel,
  channel_platform,
  ad_type,
  raw_copy,
  buyer_stage,
  offer_type,
  emotional_driver,
  hook_analysis,
  strategist_takeaway,
  product_category,
  offer_theme,
  page_title,
  page_description,
  extracted_offer,
  detected_cta,
  primary_cta,
  product_type,
  offer_signal,
  market_signal,
  description,
  headline,
  hook,
  first_seen,
  last_seen,
  times_seen,
  days_running,
  campaign_cluster,
  media_url,
  creative_url,
  landing_url,
  source_archive_url,
  source_platform,
  creative_hash,
  canonical_fingerprint,
  scan_id,
  category,
  confidence_score,
  created_at,
  raw,
  normalized_product
FROM ranked
WHERE _dedup_rank = 1;

COMMENT ON VIEW public.normalized_ad_placements IS
  'Deduped placements: one row per (domain, canonical_fingerprint). Prefer richest enrichment.';

-- 4. Audit log table for data quality guardian runs
CREATE TABLE IF NOT EXISTS public.data_quality_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  pass_count integer NOT NULL DEFAULT 7,
  errors integer NOT NULL DEFAULT 0,
  warnings integer NOT NULL DEFAULT 0,
  domains_checked integer NOT NULL DEFAULT 0,
  placements_checked integer NOT NULL DEFAULT 0,
  duplicate_groups integer NOT NULL DEFAULT 0,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'running'
);

GRANT SELECT ON public.data_quality_runs TO authenticated;
GRANT ALL ON public.data_quality_runs TO service_role;
