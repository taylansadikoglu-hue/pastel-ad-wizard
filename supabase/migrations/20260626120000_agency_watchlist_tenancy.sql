-- Tenancy alignment: agency_watchlist as source of truth for scoped intelligence.

CREATE TABLE IF NOT EXISTS public.agencies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agency_watchlist (
  id SERIAL PRIMARY KEY,
  agency_id INTEGER NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_domain TEXT NOT NULL,
  competitor_domain TEXT,
  category TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agency_watchlist_agency_id
  ON public.agency_watchlist (agency_id);

CREATE INDEX IF NOT EXISTS idx_agency_watchlist_domains
  ON public.agency_watchlist (agency_id, client_domain, competitor_domain);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agency_id INTEGER REFERENCES public.agencies(id);

-- Seed a default agency for migrated rows.
INSERT INTO public.agencies (id, name, domain)
VALUES (1, 'RevenuAD Demo Agency', 'revenuad.com')
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.agencies', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.agencies), 1)
);

-- Migrate legacy client_watchlists → agency_watchlist (agency_id = 1).
INSERT INTO public.agency_watchlist (agency_id, client_name, client_domain, competitor_domain, category, country)
SELECT
  1,
  cw.client_name,
  cw.client_domain,
  COALESCE(cwc.competitor_domain, cw.client_domain),
  cw.category,
  cw.country
FROM public.client_watchlists cw
LEFT JOIN public.client_watchlist_competitors cwc ON cwc.watchlist_id = cw.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.agency_watchlist aw
  WHERE aw.agency_id = 1
    AND aw.client_domain = cw.client_domain
    AND COALESCE(aw.competitor_domain, '') = COALESCE(cwc.competitor_domain, cw.client_domain, '')
);

-- Backwards-compatible read view (maps to agency_watchlist).
CREATE OR REPLACE VIEW public.ra_agency_watchlist AS
SELECT
  aw.id,
  aw.agency_id,
  aw.client_name,
  aw.client_domain,
  aw.competitor_domain,
  aw.category,
  aw.country,
  aw.created_at
FROM public.agency_watchlist aw;

-- Link existing profiles without agency to default agency.
UPDATE public.profiles
SET agency_id = 1
WHERE agency_id IS NULL;

ALTER TABLE public.agency_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agency_watchlist_select_own ON public.agency_watchlist;
CREATE POLICY agency_watchlist_select_own ON public.agency_watchlist
  FOR SELECT TO authenticated
  USING (
    agency_id IN (
      SELECT p.agency_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.agency_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS agency_watchlist_insert_own ON public.agency_watchlist;
CREATE POLICY agency_watchlist_insert_own ON public.agency_watchlist
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT p.agency_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.agency_id IS NOT NULL
    )
  );

-- Ensure new users get an agency row on profile upsert.
CREATE OR REPLACE FUNCTION public.ensure_profile_agency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id INTEGER;
BEGIN
  IF NEW.agency_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.agencies (name, domain)
  VALUES (COALESCE(NEW.agency_name, 'My Agency'), NEW.agency_domain)
  RETURNING id INTO v_agency_id;

  NEW.agency_id := v_agency_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_profile_agency ON public.profiles;
CREATE TRIGGER trg_ensure_profile_agency
  BEFORE INSERT OR UPDATE OF agency_name, agency_domain ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_profile_agency();
