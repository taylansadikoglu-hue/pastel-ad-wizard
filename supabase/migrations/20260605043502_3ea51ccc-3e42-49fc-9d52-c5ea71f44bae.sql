
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_name TEXT,
  agency_domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- integrations (per-agency API keys)
CREATE TABLE public.integrations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  apify_token TEXT,
  dataforseo_login TEXT,
  dataforseo_password TEXT,
  resend_api_key TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own integrations" ON public.integrations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- domain scans
CREATE TABLE public.domain_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX domain_scans_user_idx ON public.domain_scans(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.domain_scans TO authenticated;
GRANT ALL ON public.domain_scans TO service_role;
ALTER TABLE public.domain_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scans" ON public.domain_scans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ad placements
CREATE TABLE public.ad_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES public.domain_scans(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  channel TEXT NOT NULL,
  hook TEXT,
  creative_url TEXT,
  days_running INT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ad_placements_user_idx ON public.ad_placements(user_id, domain, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_placements TO authenticated;
GRANT ALL ON public.ad_placements TO service_role;
ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own placements" ON public.ad_placements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- sentiment insights (AI distillation output)
CREATE TABLE public.sentiment_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES public.domain_scans(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  good TEXT,
  friction TEXT,
  blueprint TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sentiment_user_idx ON public.sentiment_insights(user_id, domain, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentiment_insights TO authenticated;
GRANT ALL ON public.sentiment_insights TO service_role;
ALTER TABLE public.sentiment_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insights" ON public.sentiment_insights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER integrations_touch BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER scans_touch BEFORE UPDATE ON public.domain_scans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- auto-create profile + integrations row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.integrations (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.domain_scans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_placements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sentiment_insights;
