
-- Fix 1: Scope ad_placements SELECT to scan owners
DROP POLICY IF EXISTS "Authenticated can view all ad_placements" ON public.ad_placements;
CREATE POLICY "Users can view ad_placements for own scans"
  ON public.ad_placements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.domain_scans ds WHERE ds.id = ad_placements.scan_id AND ds.user_id = auth.uid()));

-- Fix 2: Add write policies on agency_profiles scoped to owner
CREATE POLICY "Users can insert own agency profile"
  ON public.agency_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own agency profile"
  ON public.agency_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own agency profile"
  ON public.agency_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Fix 3: Allow authenticated realtime subscriptions (anon stays denied)
DROP POLICY IF EXISTS "deny_authenticated_realtime_messages" ON realtime.messages;
CREATE POLICY "authenticated_can_receive_realtime_messages"
  ON realtime.messages FOR SELECT TO authenticated
  USING (true);
