
-- Allow users to delete their own domain scans
CREATE POLICY "Users can delete own scans"
  ON public.domain_scans
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to delete ad_placements that belong to their own scans
CREATE POLICY "Users can delete placements from own scans"
  ON public.ad_placements
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.domain_scans s
    WHERE s.id = ad_placements.scan_id
      AND s.user_id = auth.uid()
  ));
