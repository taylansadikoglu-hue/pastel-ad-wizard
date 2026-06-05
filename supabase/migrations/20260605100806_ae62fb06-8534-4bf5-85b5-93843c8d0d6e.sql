
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_status text NOT NULL DEFAULT 'inactive';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := 'inactive';
BEGIN
  IF lower(NEW.email) = 'taylan.sadikoglu@gmail.com' THEN
    v_status := 'active';
  END IF;

  INSERT INTO public.profiles (id, stripe_status)
  VALUES (NEW.id, v_status)
  ON CONFLICT (id) DO UPDATE SET stripe_status = EXCLUDED.stripe_status;

  INSERT INTO public.integrations (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

UPDATE public.profiles p
SET stripe_status = 'active'
FROM auth.users u
WHERE u.id = p.id
  AND lower(u.email) = 'taylan.sadikoglu@gmail.com';
