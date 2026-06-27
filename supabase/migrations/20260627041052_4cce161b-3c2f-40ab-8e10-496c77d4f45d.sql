
-- agencies table (tenant containers)
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agencies TO authenticated;
GRANT ALL ON public.agencies TO service_role;

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their agency" ON public.agencies;
CREATE POLICY "Owners manage their agency" ON public.agencies
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP TRIGGER IF EXISTS agencies_set_updated_at ON public.agencies;
CREATE TRIGGER agencies_set_updated_at BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- agency_watchlist (scoped competitor domains per agency)
CREATE TABLE IF NOT EXISTS public.agency_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  domain text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, domain)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_watchlist TO authenticated;
GRANT ALL ON public.agency_watchlist TO service_role;

ALTER TABLE public.agency_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read agency watchlist" ON public.agency_watchlist;
CREATE POLICY "Members read agency watchlist" ON public.agency_watchlist
  FOR SELECT TO authenticated
  USING (agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owners write agency watchlist" ON public.agency_watchlist;
CREATE POLICY "Owners write agency watchlist" ON public.agency_watchlist
  FOR ALL TO authenticated
  USING (agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid()))
  WITH CHECK (agency_id IN (SELECT id FROM public.agencies WHERE owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS agency_watchlist_agency_idx ON public.agency_watchlist (agency_id);
