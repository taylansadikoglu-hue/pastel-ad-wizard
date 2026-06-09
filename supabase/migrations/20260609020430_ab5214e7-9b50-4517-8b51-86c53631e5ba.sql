-- 1. Enable pg_net for outbound HTTP from the database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Shared secret table (service_role only)
CREATE TABLE IF NOT EXISTS public.webhook_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.webhook_secrets TO service_role;
ALTER TABLE public.webhook_secrets ENABLE ROW LEVEL SECURITY;
-- intentionally no policies => anon/authenticated cannot read; service_role bypasses RLS

INSERT INTO public.webhook_secrets (name, value)
VALUES ('scan_ready', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

-- 3. Per-scan idempotency log
CREATE TABLE IF NOT EXISTS public.scan_email_log (
  scan_id bigint PRIMARY KEY REFERENCES public.domain_scans(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  provider_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scan_email_log TO authenticated;
GRANT ALL ON public.scan_email_log TO service_role;
ALTER TABLE public.scan_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scan emails" ON public.scan_email_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.domain_scans s
    WHERE s.id = scan_email_log.scan_id AND s.user_id = auth.uid()
  ));

-- 4. Trigger function
CREATE OR REPLACE FUNCTION public.notify_scan_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret text;
  v_url text := 'https://project--15bb24d3-9227-4d67-a5c1-a2f708df02f5.lovable.app/api/public/hooks/scan-ready';
BEGIN
  IF NEW.status IN ('completed','ready')
     AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN

    SELECT value INTO v_secret FROM public.webhook_secrets WHERE name = 'scan_ready';
    IF v_secret IS NULL THEN
      RAISE WARNING 'notify_scan_ready: secret missing, skipping';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := jsonb_build_object('scan_id', NEW.id),
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_scan_ready ON public.domain_scans;
CREATE TRIGGER trg_notify_scan_ready
  AFTER INSERT OR UPDATE OF status ON public.domain_scans
  FOR EACH ROW EXECUTE FUNCTION public.notify_scan_ready();
