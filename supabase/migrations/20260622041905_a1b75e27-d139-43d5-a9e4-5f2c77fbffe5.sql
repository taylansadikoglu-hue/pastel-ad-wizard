-- Replace owner-scoped SELECT with permissive read for all authenticated users.
DROP POLICY IF EXISTS "Users can view placements from own scans" ON public.ad_placements;
DROP POLICY IF EXISTS "Authenticated can view all ad_placements" ON public.ad_placements;
CREATE POLICY "Authenticated can view all ad_placements"
  ON public.ad_placements
  FOR SELECT
  TO authenticated
  USING (true);

-- Remove the authenticated DELETE policy. INSERT/UPDATE/DELETE remain
-- with service_role only (covered by the existing "Allow service role
-- absolute access" ALL policy).
DROP POLICY IF EXISTS "Users can delete placements from own scans" ON public.ad_placements;