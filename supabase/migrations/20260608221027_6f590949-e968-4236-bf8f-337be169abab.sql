-- 1) profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_name text,
  agency_domain text,
  stripe_status text NOT NULL DEFAULT 'inactive',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_stripe_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stripe_status IS DISTINCT FROM OLD.stripe_status THEN
    IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'stripe_status can only be changed by the billing webhook';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_block_stripe_status_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_stripe_status_change();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) integrations
CREATE TABLE IF NOT EXISTS public.integrations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  apify_token text,
  dataforseo_login text,
  dataforseo_password text,
  resend_api_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own integrations"
  ON public.integrations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER integrations_set_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) sentiment_insights
CREATE TABLE IF NOT EXISTS public.sentiment_insights (
  id bigserial PRIMARY KEY,
  scan_id bigint REFERENCES public.domain_scans(id) ON DELETE CASCADE,
  domain text NOT NULL,
  good text,
  friction text,
  blueprint text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sentiment_insights TO authenticated;
GRANT ALL ON public.sentiment_insights TO service_role;

ALTER TABLE public.sentiment_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sentiment insights"
  ON public.sentiment_insights FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4) ad_placements column backfill
ALTER TABLE public.ad_placements
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS hook text,
  ADD COLUMN IF NOT EXISTS days_running integer,
  ADD COLUMN IF NOT EXISTS creative_url text,
  ADD COLUMN IF NOT EXISTS raw jsonb;

UPDATE public.ad_placements SET channel = channel_platform WHERE channel IS NULL AND channel_platform IS NOT NULL;
UPDATE public.ad_placements SET creative_url = media_url WHERE creative_url IS NULL AND media_url IS NOT NULL;
UPDATE public.ad_placements SET hook = ad_title WHERE hook IS NULL AND ad_title IS NOT NULL;

-- 5) Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();