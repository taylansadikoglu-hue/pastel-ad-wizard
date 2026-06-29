-- Destination Intelligence: deduplicated landing-page catalog per advertiser.
-- Populated by the enrichment worker from ad_placements / engine ads with landing_url.

CREATE TABLE IF NOT EXISTS public.advertiser_destinations (
  id            bigserial PRIMARY KEY,
  advertiser    text NOT NULL,
  domain        text NOT NULL,
  url           text NOT NULL,
  url_hash      text NOT NULL,
  page_title    text,
  product       text,
  offer         text,
  cta           text,
  persona       text,
  theme         text,
  funnel_stage  text,
  first_seen    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz NOT NULL DEFAULT now(),
  ad_count      integer NOT NULL DEFAULT 1,
  enrichment_status text NOT NULL DEFAULT 'pending',
  enriched_at   timestamptz,
  raw_snapshot  jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advertiser_destinations_advertiser_url_hash_key UNIQUE (advertiser, url_hash)
);

CREATE INDEX IF NOT EXISTS advertiser_destinations_advertiser_idx
  ON public.advertiser_destinations (advertiser);

CREATE INDEX IF NOT EXISTS advertiser_destinations_domain_idx
  ON public.advertiser_destinations (domain);

CREATE INDEX IF NOT EXISTS advertiser_destinations_last_seen_idx
  ON public.advertiser_destinations (last_seen DESC);

ALTER TABLE public.ad_placements
  ADD COLUMN IF NOT EXISTS destination_id bigint REFERENCES public.advertiser_destinations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ad_placements_destination_id_idx
  ON public.ad_placements (destination_id)
  WHERE destination_id IS NOT NULL;

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_advertiser_destinations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS advertiser_destinations_updated_at ON public.advertiser_destinations;
CREATE TRIGGER advertiser_destinations_updated_at
  BEFORE UPDATE ON public.advertiser_destinations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_advertiser_destinations_updated_at();

ALTER TABLE public.advertiser_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view destinations for scanned advertisers" ON public.advertiser_destinations;
CREATE POLICY "Users can view destinations for scanned advertisers"
  ON public.advertiser_destinations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.domain_scans ds
      WHERE ds.user_id = auth.uid()
        AND (
          lower(ds.domain) = lower(advertiser_destinations.advertiser)
          OR lower(ds.domain) LIKE lower(advertiser_destinations.advertiser) || '.%'
          OR lower(advertiser_destinations.advertiser) LIKE lower(ds.domain) || '.%'
        )
    )
  );

DROP POLICY IF EXISTS "Service role manages advertiser destinations" ON public.advertiser_destinations;
CREATE POLICY "Service role manages advertiser destinations"
  ON public.advertiser_destinations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.advertiser_destinations TO authenticated;
GRANT ALL ON public.advertiser_destinations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.advertiser_destinations_id_seq TO service_role;
