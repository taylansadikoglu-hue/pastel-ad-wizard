-- agency_profiles: per-owner SELECT
DROP POLICY IF EXISTS "Users can view their own agency profile" ON public.agency_profiles;
CREATE POLICY "Users can view their own agency profile"
  ON public.agency_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- spend_alerts: per-owner SELECT
DROP POLICY IF EXISTS "Users can view their own spend alerts" ON public.spend_alerts;
CREATE POLICY "Users can view their own spend alerts"
  ON public.spend_alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- spend_snapshots: SELECT scoped through domain_scans ownership
DROP POLICY IF EXISTS "Users can view snapshots from own scans" ON public.spend_snapshots;
CREATE POLICY "Users can view snapshots from own scans"
  ON public.spend_snapshots FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.domain_scans s
    WHERE s.id = spend_snapshots.scan_id AND s.user_id = auth.uid()
  ));

-- Remove materialized view from Data API exposure
REVOKE ALL ON public.mv_safety_ad_trends FROM anon, authenticated;