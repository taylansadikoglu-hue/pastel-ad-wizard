-- Transactional email suppressions + provider events (Resend bounces/complaints)

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('bounce', 'complaint', 'manual', 'unsubscribe')),
  provider_event_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  email text,
  provider_id text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_events_email_idx ON public.email_events (lower(email));
CREATE INDEX IF NOT EXISTS email_events_type_idx ON public.email_events (event_type);
CREATE INDEX IF NOT EXISTS email_events_created_idx ON public.email_events (created_at DESC);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_suppressions IS 'Emails blocked from all outbound sends (bounce, complaint, manual).';
COMMENT ON TABLE public.email_events IS 'Inbound Resend webhook events for audit and suppression.';
