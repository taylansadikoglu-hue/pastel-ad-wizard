ALTER TABLE public.domain_scans
  ADD COLUMN IF NOT EXISTS estimated_monthly_spend numeric,
  ADD COLUMN IF NOT EXISTS total_paid_keywords integer,
  ADD COLUMN IF NOT EXISTS average_cpc numeric;