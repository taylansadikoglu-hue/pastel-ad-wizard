-- Protect realtime.messages (broadcast + presence channel traffic)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior attempt so this migration is idempotent
DROP POLICY IF EXISTS "deny_anon_realtime_messages" ON realtime.messages;
DROP POLICY IF EXISTS "deny_authenticated_realtime_messages" ON realtime.messages;
DROP POLICY IF EXISTS "service_role_all_realtime_messages" ON realtime.messages;

-- Deny anonymous access to broadcast/presence
CREATE POLICY "deny_anon_realtime_messages"
ON realtime.messages
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Deny authenticated user access to broadcast/presence
-- (postgres_changes subscriptions are unaffected — those are gated by each
--  source table's own RLS, not by realtime.messages.)
CREATE POLICY "deny_authenticated_realtime_messages"
ON realtime.messages
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Allow trusted server code (service role) full access
CREATE POLICY "service_role_all_realtime_messages"
ON realtime.messages
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);