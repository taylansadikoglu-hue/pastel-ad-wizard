-- Landing page enrichment fields for advertiser_destinations.

ALTER TABLE public.advertiser_destinations
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS h1 text,
  ADD COLUMN IF NOT EXISTS h2s text[],
  ADD COLUMN IF NOT EXISTS visible_offers text[],
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS raw_snapshot jsonb;

CREATE INDEX IF NOT EXISTS advertiser_destinations_enrichment_status_idx
  ON public.advertiser_destinations (enrichment_status)
  WHERE enrichment_status <> 'ready';
