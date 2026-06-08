-- Enable RLS on tables exposed to PostgREST + add user-scoped policies.
-- The service_role policies already exist; we add user-facing ones.

ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertiser_matrix ENABLE ROW LEVEL SECURITY;
-- system_config already has RLS enabled per schema; ensure it stays on
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- domain_scans: each authenticated user can read/insert their own scans
CREATE POLICY "Users can view own scans"
  ON public.domain_scans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans"
  ON public.domain_scans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ad_placements: readable only when the parent scan belongs to the user
CREATE POLICY "Users can view placements from own scans"
  ON public.ad_placements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.domain_scans s
      WHERE s.id = ad_placements.scan_id
        AND s.user_id = auth.uid()
    )
  );

-- advertiser_matrix: readable only when the user has a scan for that domain
CREATE POLICY "Users can view matrix for own scanned domains"
  ON public.advertiser_matrix FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.domain_scans s
      WHERE s.domain = advertiser_matrix.domain
        AND s.user_id = auth.uid()
    )
  );

-- Ensure standard grants are in place (Supabase default, but explicit is safer)
GRANT SELECT, INSERT ON public.domain_scans TO authenticated;
GRANT SELECT ON public.ad_placements TO authenticated;
GRANT SELECT ON public.advertiser_matrix TO authenticated;
GRANT ALL ON public.domain_scans, public.ad_placements, public.advertiser_matrix, public.system_config TO service_role;