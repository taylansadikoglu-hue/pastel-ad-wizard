-- OpenAI destination tagging cache (keyed by url_hash).

ALTER TABLE public.advertiser_destinations
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS campaign_objective text,
  ADD COLUMN IF NOT EXISTS promise text,
  ADD COLUMN IF NOT EXISTS pain_point text,
  ADD COLUMN IF NOT EXISTS proof_point text,
  ADD COLUMN IF NOT EXISTS ai_tags jsonb,
  ADD COLUMN IF NOT EXISTS ai_tagged_at timestamptz;

CREATE INDEX IF NOT EXISTS advertiser_destinations_url_hash_tagged_idx
  ON public.advertiser_destinations (url_hash)
  WHERE ai_tagged_at IS NOT NULL;
