-- AdLibrary pipeline rows are global showcase data (not tied to a user scan).
-- Demo + authenticated users need read access for channel mix and war room creatives.

DROP POLICY IF EXISTS "Users can view adlibrary placements" ON public.ad_placements;
CREATE POLICY "Users can view adlibrary placements"
  ON public.ad_placements FOR SELECT TO authenticated
  USING (source_platform = 'adlibrary');
