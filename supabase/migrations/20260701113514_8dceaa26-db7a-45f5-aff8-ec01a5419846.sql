
-- client_workspaces: enable RLS + agency-scoped policies
ALTER TABLE public.client_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency owners can view their client workspaces"
  ON public.client_workspaces FOR SELECT
  TO authenticated
  USING (
    agency_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = client_workspaces.agency_id AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Agency owners can insert client workspaces"
  ON public.client_workspaces FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = client_workspaces.agency_id AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Agency owners can update client workspaces"
  ON public.client_workspaces FOR UPDATE
  TO authenticated
  USING (
    agency_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = client_workspaces.agency_id AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    agency_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = client_workspaces.agency_id AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "Agency owners can delete client workspaces"
  ON public.client_workspaces FOR DELETE
  TO authenticated
  USING (
    agency_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = client_workspaces.agency_id AND a.owner_id = auth.uid()
    )
  );

-- Backend-only tables: enable RLS with no policies (service_role bypasses)
ALTER TABLE public.adlibrary_advertiser_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adlibrary_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adlibrary_pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adlibrary_winning_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_quality_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_sources ENABLE ROW LEVEL SECURITY;

-- spend_snapshots: add fallback so backend-inserted rows (scan_id IS NULL)
-- are visible to users who own a scan for the same domain.
CREATE POLICY "Users can view orphan snapshots for their scanned domains"
  ON public.spend_snapshots FOR SELECT
  TO authenticated
  USING (
    scan_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.domain_scans s
      WHERE s.domain = spend_snapshots.domain AND s.user_id = auth.uid()
    )
  );
